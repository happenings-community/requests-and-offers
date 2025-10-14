#!/bin/bash

# kangaroo-deployer.sh - Kangaroo Electron deployment automation
# Handles Kangaroo repository setup, building, and release management

set -euo pipefail

# Source validation utilities
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/validation.sh"

# Update web-happ.yaml with new version URL
update_webhapp_config() {
    local version="$1"
    local kangaroo_path
    kangaroo_path=$(get_config '.repositories.kangaroo.path')
    local main_owner
    main_owner=$(get_config '.repositories.main.owner')
    local main_repo
    main_repo=$(get_config '.repositories.main.repo')
    local webapp_filename
    webapp_filename=$(get_config '.build.webapp_filename')
    
    local webhapp_config="$kangaroo_path/pouch/web-happ.yaml"
    local webhapp_url="https://github.com/$main_owner/$main_repo/releases/download/v$version/$webapp_filename"
    
    log_info "Updating web-happ.yaml with version $version"
    
    # Create backup
    if [[ -f "$webhapp_config" ]]; then
        cp "$webhapp_config" "$webhapp_config.backup"
    fi
    
    # Create or update web-happ.yaml
    cat > "$webhapp_config" << EOF
name: "Requests and Offers"
description: "Holochain app for community requests and offers exchange"
webhapp_url: "$webhapp_url"
EOF
    
    log_success "Updated web-happ.yaml with URL: $webhapp_url"
    log_json "success" "WebHapp config updated" "{\"version\":\"$version\",\"url\":\"$webhapp_url\"}"
}

# Switch Kangaroo repository to release branch
switch_to_release_branch() {
    local kangaroo_path
    kangaroo_path=$(get_config '.repositories.kangaroo.path')
    
    log_info "Switching Kangaroo repository to release branch"
    
    pushd "$kangaroo_path" > /dev/null
    
    # Fetch latest changes
    git fetch origin
    
    # Switch to release branch
    if git branch -r | grep -q "origin/release"; then
        git checkout release
        git pull origin release
    else
        log_warning "Release branch doesn't exist, creating from main"
        git checkout -b release origin/main
    fi
    
    # Merge main into release
    git merge main --no-edit
    
    popd > /dev/null
    
    log_success "Switched to release branch and merged main"
    log_json "success" "Switched to release branch" "null"
}

# Commit changes to Kangaroo repository
commit_kangaroo_changes() {
    local version="$1"
    local kangaroo_path
    kangaroo_path=$(get_config '.repositories.kangaroo.path')
    
    log_info "Committing Kangaroo changes for version $version"
    
    pushd "$kangaroo_path" > /dev/null
    
    # Stage changes
    git add .
    
    # Check if there are changes to commit
    if git diff --staged --quiet; then
        log_info "No changes to commit in Kangaroo repository"
        popd > /dev/null
        return 0
    fi
    
    # Create commit message
    local commit_message="release: trigger complete asset build for v$version

Ensures all platform assets (Windows, macOS, Linux) are uploaded 
to the existing v$version release with latest improvements."
    
    # Commit changes
    git commit -m "$commit_message"
    
    popd > /dev/null
    
    log_success "Committed Kangaroo changes"
    log_json "success" "Kangaroo changes committed" "{\"version\":\"$version\"}"
}

# Create draft release in Kangaroo repository
create_kangaroo_release() {
    local version="$1"
    local kangaroo_owner
    kangaroo_owner=$(get_config '.repositories.kangaroo.owner')
    local kangaroo_repo
    kangaroo_repo=$(get_config '.repositories.kangaroo.repo')
    
    log_info "Creating draft release in Kangaroo repository"
    
    # Check if release already exists
    if gh release view "v$version" --repo "$kangaroo_owner/$kangaroo_repo" &> /dev/null; then
        log_warning "Release v$version already exists in $kangaroo_owner/$kangaroo_repo"
        return 0
    fi
    
    # Create draft release
    if ! gh release create "v$version" \
        --repo "$kangaroo_owner/$kangaroo_repo" \
        --title "v$version Desktop Apps" \
        --notes "Cross-platform desktop applications for Requests and Offers v$version" \
        --draft \
        --prerelease; then
        log_error "Failed to create Kangaroo release"
        return 1
    fi
    
    log_success "Created draft release in Kangaroo repository"
    log_json "success" "Kangaroo draft release created" "{\"version\":\"$version\"}"
}

# Trigger build by pushing to release branch
trigger_build() {
    local version="$1"
    local kangaroo_path
    kangaroo_path=$(get_config '.repositories.kangaroo.path')
    
    log_info "Triggering build by pushing to release branch"
    
    pushd "$kangaroo_path" > /dev/null
    
    # Push to trigger GitHub Actions
    if ! git push origin release; then
        log_error "Failed to push to release branch"
        popd > /dev/null
        return 1
    fi
    
    popd > /dev/null
    
    log_success "Build triggered successfully"
    log_json "success" "Build triggered" "{\"version\":\"$version\"}"
}

# Monitor build progress
monitor_build() {
    local version="$1"
    local timeout_minutes="${2:-15}"
    local kangaroo_owner
    kangaroo_owner=$(get_config '.repositories.kangaroo.owner')
    local kangaroo_repo
    kangaroo_repo=$(get_config '.repositories.kangaroo.repo')
    
    log_info "Monitoring build progress (timeout: ${timeout_minutes}m)"
    
    # Wait for build completion
    if ! wait_for_build "$kangaroo_owner" "$kangaroo_repo" "$timeout_minutes"; then
        log_error "Build monitoring failed"
        return 1
    fi
    
    log_success "Build completed successfully"
    log_json "success" "Build completed" "{\"version\":\"$version\"}"
}

# Validate all platform assets are uploaded
validate_platform_assets() {
    local version="$1"
    local kangaroo_owner
    kangaroo_owner=$(get_config '.repositories.kangaroo.owner')
    local kangaroo_repo
    kangaroo_repo=$(get_config '.repositories.kangaroo.repo')
    
    log_info "Validating platform assets for v$version"
    
    # Validate assets using the validation utility
    if ! validate_release_assets "$version" "$kangaroo_owner" "$kangaroo_repo"; then
        log_error "Asset validation failed"
        return 1
    fi
    
    log_success "All platform assets validated"
    log_json "success" "Platform assets validated" "{\"version\":\"$version\"}"
}

# Publish the draft release
publish_kangaroo_release() {
    local version="$1"
    local kangaroo_owner
    kangaroo_owner=$(get_config '.repositories.kangaroo.owner')
    local kangaroo_repo
    kangaroo_repo=$(get_config '.repositories.kangaroo.repo')
    
    log_info "Publishing Kangaroo release v$version"
    
    # Publish the draft release
    if ! gh release edit "v$version" \
        --repo "$kangaroo_owner/$kangaroo_repo" \
        --draft=false; then
        log_error "Failed to publish Kangaroo release"
        return 1
    fi
    
    log_success "Published Kangaroo release v$version"
    log_json "success" "Kangaroo release published" "{\"version\":\"$version\"}"
}

# Get build status
get_build_status() {
    local kangaroo_owner
    kangaroo_owner=$(get_config '.repositories.kangaroo.owner')
    local kangaroo_repo
    kangaroo_repo=$(get_config '.repositories.kangaroo.repo')
    
    # Get latest workflow run
    local run_info
    run_info=$(gh run list --repo "$kangaroo_owner/$kangaroo_repo" --limit 1 --json status,conclusion,url -q '.[0]')
    
    local status
    status=$(echo "$run_info" | jq -r '.status')
    local conclusion
    conclusion=$(echo "$run_info" | jq -r '.conclusion')
    local url
    url=$(echo "$run_info" | jq -r '.url')
    
    echo "Status: $status"
    if [[ "$status" == "completed" ]]; then
        echo "Conclusion: $conclusion"
    fi
    echo "URL: $url"
    
    log_json "info" "Build status retrieved" "{\"status\":\"$status\",\"conclusion\":\"$conclusion\",\"url\":\"$url\"}"
}

# Full Kangaroo deployment process
deploy_kangaroo() {
    local version="$1"
    local timeout_minutes="${2:-15}"
    local dry_run="${3:-false}"
    
    log_info "Starting Kangaroo deployment for v$version"
    
    if [[ "$dry_run" == "true" ]]; then
        log_info "[DRY RUN] Would perform the following actions:"
        log_info "  1. Switch to release branch"
        log_info "  2. Update web-happ.yaml with version $version"
        log_info "  3. Update kangaroo.config.ts version"
        log_info "  4. Create draft GitHub release"
        log_info "  5. Commit and push changes"
        log_info "  6. Monitor build progress (timeout: ${timeout_minutes}m)"
        log_info "  7. Validate platform assets"
        log_info "  8. Publish release"
        return 0
    fi
    
    # Switch to release branch
    if ! switch_to_release_branch; then
        log_error "Failed to switch to release branch"
        return 1
    fi
    
    # Update web-happ.yaml
    if ! update_webhapp_config "$version"; then
        log_error "Failed to update webhapp config"
        return 1
    fi
    
    # Create draft release first (required by build process)
    if ! create_kangaroo_release "$version"; then
        log_error "Failed to create Kangaroo release"
        return 1
    fi
    
    # Commit changes
    if ! commit_kangaroo_changes "$version"; then
        log_error "Failed to commit changes"
        return 1
    fi
    
    # Trigger build
    if ! trigger_build "$version"; then
        log_error "Failed to trigger build"
        return 1
    fi
    
    # Monitor build progress
    if ! monitor_build "$version" "$timeout_minutes"; then
        log_error "Build failed or timed out"
        return 1
    fi
    
    # Validate assets
    if ! validate_platform_assets "$version"; then
        log_error "Asset validation failed"
        return 1
    fi
    
    # Publish release
    if ! publish_kangaroo_release "$version"; then
        log_error "Failed to publish release"
        return 1
    fi
    
    log_success "Kangaroo deployment completed for v$version"
    log_json "success" "Kangaroo deployment completed" "{\"version\":\"$version\"}"
}

# Main Kangaroo deployer orchestrator
main() {
    local command="${1:-help}"
    
    case "$command" in
        "branch")
            load_config
            switch_to_release_branch
            ;;
        "webhapp")
            load_config
            update_webhapp_config "$2"
            ;;
        "release")
            load_config
            create_kangaroo_release "$2"
            ;;
        "commit")
            load_config
            commit_kangaroo_changes "$2"
            ;;
        "build")
            load_config
            trigger_build "$2"
            ;;
        "monitor")
            load_config
            monitor_build "$2" "${3:-15}"
            ;;
        "validate")
            load_config
            validate_platform_assets "$2"
            ;;
        "publish")
            load_config
            publish_kangaroo_release "$2"
            ;;
        "status")
            load_config
            get_build_status
            ;;
        "deploy")
            load_config
            deploy_kangaroo "$2" "${3:-15}" "${4:-false}"
            ;;
        "help"|*)
            echo "Usage: $0 <command> [args...]"
            echo ""
            echo "Commands:"
            echo "  branch                      - Switch to release branch"
            echo "  webhapp <version>          - Update web-happ.yaml"
            echo "  release <version>          - Create draft release"
            echo "  commit <version>           - Commit changes"
            echo "  build <version>            - Trigger build"
            echo "  monitor <version> [timeout] - Monitor build progress"
            echo "  validate <version>         - Validate platform assets"
            echo "  publish <version>          - Publish release"
            echo "  status                     - Get build status"
            echo "  deploy <version> [timeout] [dry_run] - Full deployment"
            echo ""
            echo "Examples:"
            echo "  $0 deploy 0.1.0-alpha.7          # Full deployment"
            echo "  $0 deploy 0.1.0-alpha.7 20 true  # Dry run with 20min timeout"
            echo "  $0 status                         # Check build status"
            echo ""
            echo "Environment variables:"
            echo "  JSON_OUTPUT=true          - Enable JSON output mode"
            ;;
    esac
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi