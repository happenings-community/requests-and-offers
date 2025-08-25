#!/bin/bash

# homebrew-updater.sh - Homebrew formula automation
# Handles automatic Homebrew formula updates with checksums

set -euo pipefail

# Source validation utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/validation.sh"

# Calculate SHA256 checksum for a URL
calculate_checksum() {
    local url="$1"
    local temp_file="/tmp/$(basename "$url")"
    
    log_info "Calculating checksum for: $url"
    
    # Download file
    if ! curl -sL "$url" -o "$temp_file"; then
        log_error "Failed to download file from: $url"
        return 1
    fi
    
    # Calculate checksum
    local checksum
    checksum=$(sha256sum "$temp_file" | cut -d' ' -f1)
    
    # Cleanup
    rm -f "$temp_file"
    
    echo "$checksum"
    log_json "success" "Checksum calculated" "{\"url\":\"$url\",\"checksum\":\"$checksum\"}"
}

# Get DMG URLs for both architectures
get_dmg_urls() {
    local version="$1"
    local kangaroo_owner
    kangaroo_owner=$(get_config '.repositories.kangaroo.owner')
    local kangaroo_repo
    kangaroo_repo=$(get_config '.repositories.kangaroo.repo')
    local app_id
    app_id=$(get_config '.build.app_id')
    
    local base_url="https://github.com/$kangaroo_owner/$kangaroo_repo/releases/download/v$version"
    local arm64_url="$base_url/$app_id-$version-arm64.dmg"
    local x64_url="$base_url/$app_id-$version-x64.dmg"
    
    echo "$arm64_url $x64_url"
}

# Calculate checksums for both DMG files
calculate_dmg_checksums() {
    local version="$1"
    
    log_info "Calculating DMG checksums for version $version"
    
    local urls
    read -r arm64_url x64_url <<< "$(get_dmg_urls "$version")"
    
    # Calculate checksums
    local arm64_checksum
    arm64_checksum=$(calculate_checksum "$arm64_url")
    if [[ $? -ne 0 ]]; then
        log_error "Failed to calculate ARM64 checksum"
        return 1
    fi
    
    local x64_checksum
    x64_checksum=$(calculate_checksum "$x64_url")
    if [[ $? -ne 0 ]]; then
        log_error "Failed to calculate x64 checksum"
        return 1
    fi
    
    echo "$arm64_checksum $x64_checksum"
    log_success "Calculated both DMG checksums"
    log_json "success" "DMG checksums calculated" "{\"arm64\":\"$arm64_checksum\",\"x64\":\"$x64_checksum\"}"
}

# Update Homebrew formula file
update_formula_file() {
    local version="$1"
    local arm64_checksum="$2"
    local x64_checksum="$3"
    local dry_run="${4:-false}"
    
    local homebrew_path
    homebrew_path=$(get_config '.repositories.homebrew.path')
    local formula_file="$homebrew_path/Casks/requests-and-offers.rb"
    
    log_info "Updating Homebrew formula: $formula_file"
    
    if [[ ! -f "$formula_file" ]]; then
        log_error "Formula file not found: $formula_file"
        return 1
    fi
    
    if [[ "$dry_run" == "true" ]]; then
        log_info "[DRY RUN] Would update formula with:"
        log_info "  Version: $version"
        log_info "  ARM64 checksum: $arm64_checksum"
        log_info "  x64 checksum: $x64_checksum"
        return 0
    fi
    
    # Create backup
    cp "$formula_file" "$formula_file.backup"
    
    # Update formula using sed
    sed -i "s/version \"[^\"]*\"/version \"$version\"/g" "$formula_file"
    
    # Update ARM64 checksum (first sha256 line)
    sed -i "0,/sha256 \"[^\"]*\"/{s/sha256 \"[^\"]*\"/sha256 \"$arm64_checksum\"/}" "$formula_file"
    
    # Update x64 checksum (second sha256 line)  
    sed -i "0,/sha256 \"$arm64_checksum\"/{p;d;}; 0,/sha256 \"[^\"]*\"/{s/sha256 \"[^\"]*\"/sha256 \"$x64_checksum\"/}" "$formula_file"
    
    log_success "Updated Homebrew formula"
    log_json "success" "Formula updated" "{\"version\":\"$version\",\"file\":\"$formula_file\"}"
}

# Validate formula syntax
validate_formula() {
    local homebrew_path
    homebrew_path=$(get_config '.repositories.homebrew.path')
    local formula_file="$homebrew_path/Casks/requests-and-offers.rb"
    
    log_info "Validating formula syntax"
    
    # Basic Ruby syntax check
    if command -v ruby &> /dev/null; then
        if ! ruby -c "$formula_file" &> /dev/null; then
            log_error "Formula syntax validation failed"
            return 1
        fi
    else
        log_warning "Ruby not available, skipping syntax validation"
    fi
    
    # Check for required fields
    local required_fields=("version" "sha256" "url" "name" "desc" "app")
    local missing_fields=()
    
    for field in "${required_fields[@]}"; do
        if ! grep -q "$field" "$formula_file"; then
            missing_fields+=("$field")
        fi
    done
    
    if [[ ${#missing_fields[@]} -gt 0 ]]; then
        log_error "Formula missing required fields: ${missing_fields[*]}"
        return 1
    fi
    
    log_success "Formula validation passed"
    log_json "success" "Formula validation passed" "null"
}

# Test formula installation locally
test_formula_installation() {
    local dry_run="${1:-false}"
    
    if [[ "$dry_run" == "true" ]]; then
        log_info "[DRY RUN] Would test formula installation locally"
        return 0
    fi
    
    log_info "Testing formula installation (this may take a few minutes)"
    
    local homebrew_path
    homebrew_path=$(get_config '.repositories.homebrew.path')
    
    # Check if Homebrew is available
    if ! command -v brew &> /dev/null; then
        log_warning "Homebrew not available, skipping installation test"
        return 0
    fi
    
    # Add tap if not already added
    local homebrew_owner
    homebrew_owner=$(get_config '.repositories.homebrew.owner')
    local homebrew_repo
    homebrew_repo=$(get_config '.repositories.homebrew.repo')
    
    if ! brew tap | grep -q "$homebrew_owner/$homebrew_repo"; then
        log_info "Adding Homebrew tap..."
        if ! brew tap "$homebrew_owner/$homebrew_repo" "$homebrew_path"; then
            log_error "Failed to add Homebrew tap"
            return 1
        fi
    fi
    
    # Test installation (uninstall first if already installed)
    log_info "Testing formula installation..."
    brew uninstall requests-and-offers &> /dev/null || true
    
    if ! brew install requests-and-offers --verbose; then
        log_error "Formula installation test failed"
        return 1
    fi
    
    # Cleanup test installation
    brew uninstall requests-and-offers &> /dev/null || true
    
    log_success "Formula installation test passed"
    log_json "success" "Formula installation test passed" "null"
}

# Commit formula changes
commit_formula_changes() {
    local version="$1"
    local dry_run="${2:-false}"
    
    local homebrew_path
    homebrew_path=$(get_config '.repositories.homebrew.path')
    
    log_info "Committing formula changes"
    
    pushd "$homebrew_path" > /dev/null
    
    if [[ "$dry_run" == "true" ]]; then
        log_info "[DRY RUN] Would commit formula changes for version $version"
        popd > /dev/null
        return 0
    fi
    
    # Stage changes
    git add Casks/requests-and-offers.rb
    
    # Check if there are changes to commit
    if git diff --staged --quiet; then
        log_info "No formula changes to commit"
        popd > /dev/null
        return 0
    fi
    
    # Commit changes
    local commit_message="feat: update formula to v$version

- Updated version to $version
- Updated SHA256 checksums for both architectures
- Verified download URLs and package integrity"
    
    git commit -m "$commit_message"
    
    popd > /dev/null
    
    log_success "Formula changes committed"
    log_json "success" "Formula changes committed" "{\"version\":\"$version\"}"
}

# Push formula changes
push_formula_changes() {
    local dry_run="${1:-false}"
    
    local homebrew_path
    homebrew_path=$(get_config '.repositories.homebrew.path')
    
    log_info "Pushing formula changes"
    
    if [[ "$dry_run" == "true" ]]; then
        log_info "[DRY RUN] Would push formula changes to remote"
        return 0
    fi
    
    pushd "$homebrew_path" > /dev/null
    
    # Push changes
    if ! git push origin main; then
        log_error "Failed to push formula changes"
        popd > /dev/null
        return 1
    fi
    
    popd > /dev/null
    
    log_success "Formula changes pushed"
    log_json "success" "Formula changes pushed" "null"
}

# Full Homebrew formula update process
update_homebrew() {
    local version="$1"
    local test_install="${2:-false}"
    local dry_run="${3:-false}"
    
    log_info "Starting Homebrew formula update for v$version"
    
    if [[ "$dry_run" == "true" ]]; then
        log_info "[DRY RUN] Would perform the following actions:"
        log_info "  1. Calculate DMG checksums"
        log_info "  2. Update formula file"
        log_info "  3. Validate formula syntax"
        if [[ "$test_install" == "true" ]]; then
            log_info "  4. Test formula installation"
        fi
        if [[ "$test_install" == "true" ]]; then
            log_info "  5. Commit changes"
            log_info "  6. Push changes"
        else
            log_info "  4. Commit changes"
            log_info "  5. Push changes"
        fi
        return 0
    fi
    
    # Calculate checksums
    log_info "Step 1: Calculating DMG checksums..."
    local checksums
    checksums=$(calculate_dmg_checksums "$version")
    if [[ $? -ne 0 ]]; then
        log_error "Failed to calculate checksums"
        return 1
    fi
    
    read -r arm64_checksum x64_checksum <<< "$checksums"
    
    # Update formula
    log_info "Step 2: Updating formula file..."
    if ! update_formula_file "$version" "$arm64_checksum" "$x64_checksum"; then
        log_error "Failed to update formula file"
        return 1
    fi
    
    # Validate formula
    log_info "Step 3: Validating formula..."
    if ! validate_formula; then
        log_error "Formula validation failed"
        return 1
    fi
    
    # Test installation if requested
    if [[ "$test_install" == "true" ]]; then
        log_info "Step 4: Testing installation..."
        if ! test_formula_installation; then
            log_error "Installation test failed"
            return 1
        fi
    fi
    
    # Commit changes
    local step_num
    if [[ "$test_install" == "true" ]]; then
        step_num=5
    else
        step_num=4
    fi
    log_info "Step $step_num: Committing changes..."
    if ! commit_formula_changes "$version"; then
        log_error "Failed to commit changes"
        return 1
    fi
    
    # Push changes
    if [[ "$test_install" == "true" ]]; then
        step_num=6
    else
        step_num=5
    fi
    log_info "Step $step_num: Pushing changes..."
    if ! push_formula_changes; then
        log_error "Failed to push changes"
        return 1
    fi
    
    log_success "Homebrew formula update completed for v$version"
    log_json "success" "Homebrew update completed" "{\"version\":\"$version\",\"arm64_checksum\":\"$arm64_checksum\",\"x64_checksum\":\"$x64_checksum\"}"
}

# Main Homebrew updater orchestrator
main() {
    local command="${1:-help}"
    
    case "$command" in
        "checksums")
            load_config
            calculate_dmg_checksums "$2"
            ;;
        "formula")
            load_config
            update_formula_file "$2" "$3" "$4" "${5:-false}"
            ;;
        "validate")
            load_config
            validate_formula
            ;;
        "test")
            load_config
            test_formula_installation "${2:-false}"
            ;;
        "commit")
            load_config
            commit_formula_changes "$2" "${3:-false}"
            ;;
        "push")
            load_config
            push_formula_changes "${2:-false}"
            ;;
        "update")
            load_config
            update_homebrew "$2" "${3:-false}" "${4:-false}"
            ;;
        "help"|*)
            echo "Usage: $0 <command> [args...]"
            echo ""
            echo "Commands:"
            echo "  checksums <version>              - Calculate DMG checksums"
            echo "  formula <version> <arm64_sha> <x64_sha> [dry_run] - Update formula"
            echo "  validate                         - Validate formula syntax"
            echo "  test [dry_run]                   - Test formula installation"
            echo "  commit <version> [dry_run]       - Commit formula changes"
            echo "  push [dry_run]                   - Push formula changes"
            echo "  update <version> [test] [dry_run] - Full update process"
            echo ""
            echo "Examples:"
            echo "  $0 update 0.1.0-alpha.7         # Update formula"
            echo "  $0 update 0.1.0-alpha.7 true    # Update and test installation"
            echo "  $0 update 0.1.0-alpha.7 false true # Dry run"
            echo ""
            echo "Environment variables:"
            echo "  JSON_OUTPUT=true                 - Enable JSON output mode"
            ;;
    esac
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi