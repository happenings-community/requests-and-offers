#!/bin/bash

# webapp-builder.sh - WebApp build and release automation
# Handles building, packaging, and releasing the main Holochain app

set -euo pipefail

# Source validation utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/validation.sh"

# Build the Holochain app
build_happ() {
    local main_path
    main_path=$(get_config '.repositories.main.path')
    
    log_info "Building Holochain app in: $main_path"
    
    # Change to main repository directory
    pushd "$main_path" > /dev/null
    
    # Clean previous builds
    log_info "Cleaning previous builds..."
    if [[ -d "workdir" ]]; then
        rm -rf workdir/*.happ workdir/*.webhapp 2>/dev/null || true
    fi
    
    # Build zomes
    log_info "Building zomes..."
    if ! bun run build:zomes; then
        log_error "Failed to build zomes"
        popd > /dev/null
        return 1
    fi
    
    # Build hApp
    log_info "Building hApp..."
    if ! bun run build:happ; then
        log_error "Failed to build hApp"
        popd > /dev/null
        return 1
    fi
    
    # Package webapp
    log_info "Packaging webapp..."
    if ! bun run package; then
        log_error "Failed to package webapp"
        popd > /dev/null
        return 1
    fi
    
    popd > /dev/null
    
    log_success "Holochain app build completed"
    log_json "success" "Holochain app build completed" "null"
}

# Run tests before building
run_tests() {
    local main_path
    main_path=$(get_config '.repositories.main.path')
    local skip_tests="${1:-false}"
    
    if [[ "$skip_tests" == "true" ]]; then
        log_info "Skipping tests (--skip-tests flag used)"
        return 0
    fi
    
    log_info "Running tests before build..."
    
    pushd "$main_path" > /dev/null
    
    # Check if in Nix environment (required for tests)
    if ! command -v hc &> /dev/null; then
        log_warning "Holochain CLI not found - tests may require 'nix develop' environment"
        log_warning "Skipping tests - run manually with: nix develop --command bun test"
        popd > /dev/null
        return 0
    fi
    
    # Run frontend checks
    log_info "Running frontend checks..."
    pushd ui > /dev/null
    if ! bun run check; then
        log_error "Frontend type checking failed"
        popd > /dev/null
        popd > /dev/null
        return 1
    fi
    popd > /dev/null
    
    # Run unit tests
    log_info "Running unit tests..."
    if ! bun run test:unit; then
        log_error "Unit tests failed"
        popd > /dev/null
        return 1
    fi
    
    popd > /dev/null
    
    log_success "All tests passed"
    log_json "success" "All tests passed" "null"
}

# Create GitHub release for main repository
create_main_release() {
    local version="$1"
    local prerelease="${2:-true}"
    local draft="${3:-false}"
    
    local main_owner
    main_owner=$(get_config '.repositories.main.owner')
    local main_repo
    main_repo=$(get_config '.repositories.main.repo')
    local main_path
    main_path=$(get_config '.repositories.main.path')
    
    log_info "Creating GitHub release for $main_owner/$main_repo v$version"
    
    # Check if release already exists
    if gh release view "v$version" --repo "$main_owner/$main_repo" &> /dev/null; then
        log_warning "Release v$version already exists in $main_owner/$main_repo"
        log_json "warning" "Release already exists" "{\"version\":\"$version\",\"repo\":\"$main_owner/$main_repo\"}"
        return 0
    fi
    
    # Generate release notes from git commits since last tag
    local release_notes
    pushd "$main_path" > /dev/null
    
    # Get last tag
    local last_tag
    last_tag=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
    
    if [[ -n "$last_tag" ]]; then
        log_info "Generating release notes since $last_tag..."
        release_notes=$(git log "${last_tag}..HEAD" --pretty=format:"- %s" --no-merges)
    else
        log_info "No previous tags found, using recent commits..."
        release_notes=$(git log --pretty=format:"- %s" --no-merges -n 10)
    fi
    
    popd > /dev/null
    
    # Create release notes file
    local notes_file="/tmp/release-notes-${version}.md"
    cat > "$notes_file" << EOF
## What's New in v${version}

${release_notes}

## Downloads

### Desktop Applications
| Platform | Architecture | Download |
|----------|-------------|----------|
| **Windows** | x64 | [Download .exe](https://github.com/happenings-community/requests-and-offers-kangaroo-electron/releases/download/v${version}/requests-and-offers.happenings-community.kangaroo-electron-${version}-setup.exe) |
| **macOS** | Apple Silicon | [Download .dmg](https://github.com/happenings-community/requests-and-offers-kangaroo-electron/releases/download/v${version}/requests-and-offers.happenings-community.kangaroo-electron-${version}-arm64.dmg) |
| **macOS** | Intel | [Download .dmg](https://github.com/happenings-community/requests-and-offers-kangaroo-electron/releases/download/v${version}/requests-and-offers.happenings-community.kangaroo-electron-${version}-x64.dmg) |
| **Linux** | x64 | [Download .AppImage](https://github.com/happenings-community/requests-and-offers-kangaroo-electron/releases/download/v${version}/requests-and-offers.happenings-community.kangaroo-electron-${version}.AppImage) |
| **Linux** | x64 | [Download .deb](https://github.com/happenings-community/requests-and-offers-kangaroo-electron/releases/download/v${version}/requests-and-offers.happenings-community.kangaroo-electron_${version}_amd64.deb) |

### Homebrew (macOS)
\`\`\`bash
brew tap happenings-community/requests-and-offers
brew install requests-and-offers
\`\`\`

### WebApp Package
- [requests_and_offers.webhapp](https://github.com/happenings-community/requests-and-offers/releases/download/v${version}/requests_and_offers.webhapp)

## Installation Instructions

Refer to the [Installation Guide](https://github.com/happenings-community/requests-and-offers#installation) for detailed setup instructions.

## Known Issues

Check our [Issues page](https://github.com/happenings-community/requests-and-offers/issues) for known issues and troubleshooting.
EOF
    
    # Create release
    local release_flags="--repo $main_owner/$main_repo --title v$version --notes-file $notes_file"
    
    if [[ "$prerelease" == "true" ]]; then
        release_flags+=" --prerelease"
    fi
    
    if [[ "$draft" == "true" ]]; then
        release_flags+=" --draft"
    fi
    
    # Execute release creation
    if ! gh release create "v$version" $release_flags; then
        log_error "Failed to create GitHub release"
        rm -f "$notes_file"
        return 1
    fi
    
    rm -f "$notes_file"
    
    log_success "Created GitHub release v$version"
    log_json "success" "GitHub release created" "{\"version\":\"$version\",\"repo\":\"$main_owner/$main_repo\"}"
}

# Upload webapp asset to release
upload_webapp_asset() {
    local version="$1"
    
    local main_owner
    main_owner=$(get_config '.repositories.main.owner')
    local main_repo
    main_repo=$(get_config '.repositories.main.repo')
    local main_path
    main_path=$(get_config '.repositories.main.path')
    local webapp_filename
    webapp_filename=$(get_config '.build.webapp_filename')
    
    local webapp_path="$main_path/workdir/$webapp_filename"
    
    log_info "Uploading webapp asset: $webapp_path"
    
    # Validate webapp exists
    if [[ ! -f "$webapp_path" ]]; then
        log_error "WebApp file not found: $webapp_path"
        return 1
    fi
    
    # Upload asset to release
    if ! gh release upload "v$version" "$webapp_path" --repo "$main_owner/$main_repo"; then
        log_error "Failed to upload webapp asset"
        return 1
    fi
    
    log_success "Uploaded webapp asset to release"
    log_json "success" "WebApp asset uploaded" "{\"version\":\"$version\",\"file\":\"$webapp_filename\"}"
}

# Update release with final download links (called after Kangaroo build)
update_release_links() {
    local version="$1"
    
    local main_owner
    main_owner=$(get_config '.repositories.main.owner')
    local main_repo
    main_repo=$(get_config '.repositories.main.repo')
    
    log_info "Updating release links for v$version"
    
    # The release notes already contain the correct download links
    # This function can be extended to update links if needed
    
    log_success "Release links are up to date"
    log_json "success" "Release links updated" "{\"version\":\"$version\"}"
}

# Full webapp build and release process
build_and_release() {
    local version="$1"
    local skip_tests="${2:-false}"
    local prerelease="${3:-true}"
    local draft="${4:-false}"
    local dry_run="${5:-false}"
    
    log_info "Starting webapp build and release process for v$version"
    
    if [[ "$dry_run" == "true" ]]; then
        log_info "[DRY RUN] Would perform the following actions:"
        log_info "  1. Run tests (skip: $skip_tests)"
        log_info "  2. Build Holochain app"
        log_info "  3. Create GitHub release (prerelease: $prerelease, draft: $draft)"
        log_info "  4. Upload webapp asset"
        return 0
    fi
    
    # Run tests
    if ! run_tests "$skip_tests"; then
        log_error "Tests failed - aborting release"
        return 1
    fi
    
    # Build app
    if ! build_happ; then
        log_error "Build failed - aborting release"
        return 1
    fi
    
    # Validate build
    if ! validate_webapp_build; then
        log_error "Build validation failed - aborting release"
        return 1
    fi
    
    # Create release
    if ! create_main_release "$version" "$prerelease" "$draft"; then
        log_error "Release creation failed - aborting"
        return 1
    fi
    
    # Upload webapp asset
    if ! upload_webapp_asset "$version"; then
        log_error "Asset upload failed - aborting"
        return 1
    fi
    
    log_success "WebApp build and release completed for v$version"
    log_json "success" "WebApp build and release completed" "{\"version\":\"$version\"}"
}

# Main webapp builder orchestrator
main() {
    local command="${1:-help}"
    
    case "$command" in
        "build")
            load_config
            build_happ
            ;;
        "test")
            load_config
            run_tests "${2:-false}"
            ;;
        "release")
            load_config
            create_main_release "$2" "${3:-true}" "${4:-false}"
            ;;
        "upload")
            load_config
            upload_webapp_asset "$2"
            ;;
        "update-links")
            load_config
            update_release_links "$2"
            ;;
        "full")
            load_config
            build_and_release "$2" "${3:-false}" "${4:-true}" "${5:-false}" "${6:-false}"
            ;;
        "help"|*)
            echo "Usage: $0 <command> [args...]"
            echo ""
            echo "Commands:"
            echo "  build                        - Build Holochain app"
            echo "  test [skip]                 - Run tests (skip=true to skip)"
            echo "  release <version> [prerelease] [draft] - Create GitHub release"
            echo "  upload <version>            - Upload webapp asset to release"
            echo "  update-links <version>      - Update release with download links"
            echo "  full <version> [skip_tests] [prerelease] [draft] [dry_run] - Full process"
            echo ""
            echo "Examples:"
            echo "  $0 full 0.1.0-alpha.7                    # Full release"
            echo "  $0 full 0.1.0-alpha.7 false false false true # Dry run"
            echo "  $0 build                                  # Just build"
            echo ""
            echo "Environment variables:"
            echo "  JSON_OUTPUT=true            - Enable JSON output mode"
            ;;
    esac
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi