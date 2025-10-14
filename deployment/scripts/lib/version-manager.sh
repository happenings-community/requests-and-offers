#!/bin/bash

# version-manager.sh - Centralized version management across repositories
# Handles version synchronization, validation, and tagging

set -euo pipefail

# Source validation utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/validation.sh"

# Update version in package.json
update_package_version() {
    local file_path="$1"
    local version="$2"
    
    log_info "Updating version in: $file_path"
    
    if [[ ! -f "$file_path" ]]; then
        log_error "Package.json not found: $file_path"
        return 1
    fi
    
    # Create backup
    cp "$file_path" "$file_path.backup"
    
    # Update version using jq
    jq --arg version "$version" '.version = $version' "$file_path" > "$file_path.tmp"
    mv "$file_path.tmp" "$file_path"
    
    log_success "Updated $file_path to version $version"
    log_json "success" "Package version updated" "{\"file\":\"$file_path\",\"version\":\"$version\"}"
}

# Update version in kangaroo.config.ts
update_kangaroo_config() {
    local config_path="$1"
    local version="$2"
    
    log_info "Updating kangaroo.config.ts version: $config_path"
    
    if [[ ! -f "$config_path" ]]; then
        log_error "Kangaroo config not found: $config_path"
        return 1
    fi
    
    # Create backup
    cp "$config_path" "$config_path.backup"
    
    # Update version in TypeScript config
    sed -i "s/version: '[^']*'/version: '$version'/g" "$config_path"
    
    log_success "Updated kangaroo.config.ts to version $version"
    log_json "success" "Kangaroo config updated" "{\"file\":\"$config_path\",\"version\":\"$version\"}"
}

# Update homebrew formula version
update_homebrew_formula() {
    local formula_path="$1"
    local version="$2"
    
    log_info "Updating Homebrew formula version: $formula_path"
    
    if [[ ! -f "$formula_path" ]]; then
        log_error "Homebrew formula not found: $formula_path"
        return 1
    fi
    
    # Create backup
    cp "$formula_path" "$formula_path.backup"
    
    # Update version in Ruby formula
    sed -i "s/version \"[^\"]*\"/version \"$version\"/g" "$formula_path"
    
    log_success "Updated Homebrew formula to version $version"
    log_json "success" "Homebrew formula updated" "{\"file\":\"$formula_path\",\"version\":\"$version\"}"
}

# Get current version from main repository
get_current_version() {
    local main_path
    main_path=$(get_config '.repositories.main.path')
    
    jq -r '.version' "$main_path/package.json"
}

# Sync version across all repositories
sync_versions() {
    local version="$1"
    local dry_run="${2:-false}"
    
    log_info "Synchronizing version $version across all repositories (dry_run: $dry_run)"
    
    # Get repository paths
    local main_path
    main_path=$(get_config '.repositories.main.path')
    local kangaroo_path
    kangaroo_path=$(get_config '.repositories.kangaroo.path')
    local homebrew_path
    homebrew_path=$(get_config '.repositories.homebrew.path')
    
    if [[ "$dry_run" == "true" ]]; then
        log_info "[DRY RUN] Would update the following files:"
        log_info "  - $main_path/package.json"
        log_info "  - $kangaroo_path/package.json"
        log_info "  - $kangaroo_path/kangaroo.config.ts"
        log_info "  - $homebrew_path/Casks/requests-and-offers.rb"
        return 0
    fi
    
    # Update all version files
    update_package_version "$main_path/package.json" "$version"
    update_package_version "$kangaroo_path/package.json" "$version"
    update_kangaroo_config "$kangaroo_path/kangaroo.config.ts" "$version"
    update_homebrew_formula "$homebrew_path/Casks/requests-and-offers.rb" "$version"
    
    log_success "Version synchronization completed"
    log_json "success" "Version synchronization completed" "{\"version\":\"$version\"}"
}

# Create git tags in all repositories
create_git_tags() {
    local version="$1"
    local dry_run="${2:-false}"
    
    log_info "Creating git tags for version $version (dry_run: $dry_run)"
    
    # Get repository paths
    local main_path
    main_path=$(get_config '.repositories.main.path')
    local kangaroo_path
    kangaroo_path=$(get_config '.repositories.kangaroo.path')
    local homebrew_path
    homebrew_path=$(get_config '.repositories.homebrew.path')
    
    local repos=("$main_path" "$kangaroo_path" "$homebrew_path")
    local repo_names=("main" "kangaroo" "homebrew")
    
    for i in "${!repos[@]}"; do
        local repo_path="${repos[$i]}"
        local repo_name="${repo_names[$i]}"
        
        if [[ ! -d "$repo_path/.git" ]]; then
            log_warning "Skipping $repo_name - not a git repository: $repo_path"
            continue
        fi
        
        if [[ "$dry_run" == "true" ]]; then
            log_info "[DRY RUN] Would create tag v$version in $repo_name repository"
            continue
        fi
        
        # Switch to repository directory
        pushd "$repo_path" > /dev/null
        
        # Check if tag already exists
        if git tag -l | grep -q "^v$version$"; then
            log_warning "Tag v$version already exists in $repo_name repository"
        else
            # Create annotated tag
            git tag -a "v$version" -m "Release version $version"
            log_success "Created tag v$version in $repo_name repository"
        fi
        
        popd > /dev/null
    done
    
    log_success "Git tag creation completed"
    log_json "success" "Git tag creation completed" "{\"version\":\"$version\"}"
}

# Push git tags to remote
push_git_tags() {
    local version="$1"
    local dry_run="${2:-false}"
    
    log_info "Pushing git tags for version $version (dry_run: $dry_run)"
    
    # Get repository paths
    local main_path
    main_path=$(get_config '.repositories.main.path')
    local kangaroo_path
    kangaroo_path=$(get_config '.repositories.kangaroo.path')
    local homebrew_path
    homebrew_path=$(get_config '.repositories.homebrew.path')
    
    local repos=("$main_path" "$kangaroo_path" "$homebrew_path")
    local repo_names=("main" "kangaroo" "homebrew")
    
    for i in "${!repos[@]}"; do
        local repo_path="${repos[$i]}"
        local repo_name="${repo_names[$i]}"
        
        if [[ ! -d "$repo_path/.git" ]]; then
            log_warning "Skipping $repo_name - not a git repository: $repo_path"
            continue
        fi
        
        if [[ "$dry_run" == "true" ]]; then
            log_info "[DRY RUN] Would push tag v$version in $repo_name repository"
            continue
        fi
        
        # Switch to repository directory
        pushd "$repo_path" > /dev/null
        
        # Push tag to origin
        if git tag -l | grep -q "^v$version$"; then
            git push origin "v$version"
            log_success "Pushed tag v$version in $repo_name repository"
        else
            log_warning "Tag v$version does not exist in $repo_name repository"
        fi
        
        popd > /dev/null
    done
    
    log_success "Git tag pushing completed"
    log_json "success" "Git tag pushing completed" "{\"version\":\"$version\"}"
}

# Validate version consistency across repositories
validate_version_consistency() {
    log_info "Validating version consistency across repositories..."
    
    # Get repository paths
    local main_path
    main_path=$(get_config '.repositories.main.path')
    local kangaroo_path
    kangaroo_path=$(get_config '.repositories.kangaroo.path')
    
    # Get versions from each source
    local main_version
    main_version=$(jq -r '.version' "$main_path/package.json")
    
    local kangaroo_version
    kangaroo_version=$(jq -r '.version' "$kangaroo_path/package.json")
    
    local kangaroo_config_version
    kangaroo_config_version=$(grep "version:" "$kangaroo_path/kangaroo.config.ts" | sed "s/.*version: '[^']*'//" | sed "s/'.*//")
    
    # Compare versions
    local inconsistencies=()
    
    if [[ "$main_version" != "$kangaroo_version" ]]; then
        inconsistencies+=("main($main_version) != kangaroo($kangaroo_version)")
    fi
    
    if [[ "$kangaroo_version" != "$kangaroo_config_version" ]]; then
        inconsistencies+=("kangaroo($kangaroo_version) != config($kangaroo_config_version)")
    fi
    
    if [[ ${#inconsistencies[@]} -gt 0 ]]; then
        log_error "Version inconsistencies found: ${inconsistencies[*]}"
        log_json "error" "Version inconsistencies found" "[\"$(IFS='","'; echo "${inconsistencies[*]}")\"]"
        return 1
    fi
    
    log_success "Version consistency validated: $main_version"
    log_json "success" "Version consistency validated" "{\"version\":\"$main_version\"}"
    return 0
}

# Bump version (major, minor, patch, or prerelease)
bump_version() {
    local bump_type="$1"
    local current_version
    current_version=$(get_current_version)
    
    log_info "Bumping version from $current_version ($bump_type)"
    
    # Parse current version
    if [[ "$current_version" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)(-(.+))?$ ]]; then
        local major="${BASH_REMATCH[1]}"
        local minor="${BASH_REMATCH[2]}"
        local patch="${BASH_REMATCH[3]}"
        local prerelease="${BASH_REMATCH[5]}"
    else
        log_error "Invalid current version format: $current_version"
        return 1
    fi
    
    local new_version
    case "$bump_type" in
        "major")
            new_version="$((major + 1)).0.0"
            ;;
        "minor")
            new_version="$major.$((minor + 1)).0"
            ;;
        "patch")
            new_version="$major.$minor.$((patch + 1))"
            ;;
        "prerelease")
            if [[ -n "$prerelease" ]]; then
                # Increment prerelease number
                if [[ "$prerelease" =~ ^(.+)\.([0-9]+)$ ]]; then
                    local pre_name="${BASH_REMATCH[1]}"
                    local pre_num="${BASH_REMATCH[2]}"
                    new_version="$major.$minor.$patch-$pre_name.$((pre_num + 1))"
                else
                    new_version="$major.$minor.$patch-$prerelease.1"
                fi
            else
                new_version="$major.$minor.$patch-alpha.1"
            fi
            ;;
        *)
            log_error "Invalid bump type: $bump_type (use: major, minor, patch, prerelease)"
            return 1
            ;;
    esac
    
    log_success "New version calculated: $new_version"
    log_json "success" "Version bumped" "{\"old\":\"$current_version\",\"new\":\"$new_version\",\"type\":\"$bump_type\"}"
    echo "$new_version"
}

# Main version manager orchestrator
main() {
    local command="${1:-help}"
    
    case "$command" in
        "get")
            load_config
            get_current_version
            ;;
        "sync")
            load_config
            validate_version "$2"
            sync_versions "$2" "${3:-false}"
            ;;
        "tag")
            load_config
            create_git_tags "$2" "${3:-false}"
            ;;
        "push-tags")
            load_config
            push_git_tags "$2" "${3:-false}"
            ;;
        "validate")
            load_config
            validate_version_consistency
            ;;
        "bump")
            load_config
            bump_version "$2"
            ;;
        "help"|*)
            echo "Usage: $0 <command> [args...]"
            echo ""
            echo "Commands:"
            echo "  get                           - Get current version from main repository"
            echo "  sync <version> [dry_run]     - Synchronize version across repositories"
            echo "  tag <version> [dry_run]      - Create git tags for version"
            echo "  push-tags <version> [dry_run] - Push git tags to remote"
            echo "  validate                     - Validate version consistency"
            echo "  bump <type>                  - Bump version (major|minor|patch|prerelease)"
            echo ""
            echo "Examples:"
            echo "  $0 sync 0.1.0-alpha.7"
            echo "  $0 sync 0.1.0-alpha.7 true    # dry run"
            echo "  $0 bump prerelease"
            echo ""
            echo "Environment variables:"
            echo "  JSON_OUTPUT=true             - Enable JSON output mode"
            ;;
    esac
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi