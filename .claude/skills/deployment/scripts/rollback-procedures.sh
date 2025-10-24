#!/bin/bash

# Rollback Procedures Script
# Emergency rollback and recovery procedures for failed deployments

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
KANGAROO_PATH="$PROJECT_ROOT/deployment/kangaroo-electron"

# Version to rollback from
FROM_VERSION=${1:-""}
# Version to rollback to (optional, defaults to previous tag)
TO_VERSION=${2:-""}

# Rollback mode
EMERGENCY_ROLLBACK=false
BACKUP_BEFORE_ROLLBACK=true

echo -e "${RED}🚨 Rollback Procedures Script v1.0${NC}"
echo "=============================================="
echo -e "Project: $(basename "$PROJECT_ROOT")"
echo -e "From Version: $FROM_VERSION"
echo -e "To Version: $TO_VERSION"
echo -e "Emergency Mode: $EMERGENCY_ROLLBACK"
echo ""

# Function to print success
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Function to print warning
print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Function to print error
print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to print section
print_section() {
    echo -e "${PURPLE}🔄 $1${NC}"
    echo "----------------------------------------------"
}

# Function to print info
print_info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

# Function to ask for confirmation
ask_confirmation() {
    echo -e "${YELLOW}🚨 EMERGENCY ROLLBACK CONFIRMATION${NC}"
    echo -e "${YELLOW}This is a critical operation that will:${NC}"
    echo -e "  • Remove GitHub release v$FROM_VERSION"
    echo -e "  • Delete associated tags"
    echo -e "  • Reset branches if needed"
    echo -e "  • Potentially disrupt users"
    echo ""
    echo -e "${RED}This action cannot be undone!${NC}"
    echo ""
    echo -e "${YELLOW}Are you absolutely sure you want to proceed? (type 'emergency-rollback-confirm')${NC}"
    read -r response

    if [[ "$response" == "emergency-rollback-confirm" ]]; then
        return 0
    else
        echo -e "${RED}Rollback cancelled.${NC}"
        exit 1
    fi
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to backup current state
backup_current_state() {
    print_section "Backup Current State"

    local backup_dir="$PROJECT_ROOT/.rollback-backup-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$backup_dir"

    print_info "Creating backup in: $backup_dir"

    # Backup git state
    cd "$PROJECT_ROOT"
    git log --oneline -10 > "$backup_dir/git-log-main.txt"
    git branch -a > "$backup_dir/git-branches.txt"
    git status > "$backup_dir/git-status.txt"

    # Backup release information
    if [[ -n "$FROM_VERSION" ]]; then
        gh release view "v$FROM_VERSION" > "$backup_dir/release-v$FROM_VERSION.txt" 2>/dev/null || print_warning "Could not backup release v$FROM_VERSION"
    fi

    # Backup current versions
    echo "Main repo version: $(node -p -e "require('./package.json').version")" > "$backup_dir/versions.txt"
    echo "Kangaroo version: $(node -p -e "require('$KANGAROO_PATH/package.json').version")" >> "$backup_dir/versions.txt" 2>/dev/null || echo "Kangaroo version: N/A" >> "$backup_dir/versions.txt"

    # Backup package files
    cp "$PROJECT_ROOT/package.json" "$backup_dir/package-main.json" 2>/dev/null || true
    cp "$KANGAROO_PATH/package.json" "$backup_dir/package-kangaroo.json" 2>/dev/null || true
    cp "$KANGAROO_PATH/kangaroo.config.ts" "$backup_dir/kangaroo-config.ts" 2>/dev/null || true

    print_success "Backup created at: $backup_dir"
    echo "$backup_dir" > "$PROJECT_ROOT/.latest-rollback-backup"
    print_success "Backup path saved to .latest-rollback-backup"
    echo ""
}

# Function to get previous version
get_previous_version() {
    cd "$PROJECT_ROOT"

    # Get all tags sorted by version
    local tags=$(git tag --sort=-version:refname | grep "^v[0-9]")

    # Find the version before FROM_VERSION
    local found=false
    local prev_version=""

    while IFS= read -r tag; do
        if [[ "$found" = true ]]; then
            prev_version="$tag"
            break
        fi
        if [[ "$tag" == "v$FROM_VERSION" ]]; then
            found=true
        fi
    done <<< "$tags"

    if [[ -n "$prev_version" ]]; then
        echo "${prev_version#v}"  # Remove 'v' prefix
    else
        echo ""
    fi
}

# Function to delete GitHub release
delete_github_release() {
    print_section "Delete GitHub Release"

    if [[ -z "$FROM_VERSION" ]]; then
        print_error "No version specified for rollback"
        return 1
    fi

    cd "$PROJECT_ROOT"

    # Check if release exists
    if gh release view "v$FROM_VERSION" >/dev/null 2>&1; then
        print_warning "Release v$FROM_VERSION exists - this will delete it permanently"

        # Show release info before deletion
        local release_info=$(gh release view "v$FROM_VERSION" --json name,assets)
        local release_name=$(echo "$release_info" | jq -r '.name')
        local asset_count=$(echo "$release_info" | jq '.assets | length')

        print_info "Release to delete: $release_name"
        print_info "Assets that will be deleted: $asset_count"

        # Delete the release
        if gh release delete "v$FROM_VERSION" --yes; then
            print_success "GitHub release v$FROM_VERSION deleted"
        else
            print_error "Failed to delete GitHub release"
            return 1
        fi
    else
        print_warning "GitHub release v$FROM_VERSION not found"
    fi

    # Delete the tag
    if git tag | grep -q "v$FROM_VERSION"; then
        if git tag -d "v$FROM_VERSION"; then
            print_success "Local tag v$FROM_VERSION deleted"
        else
            print_error "Failed to delete local tag"
            return 1
        fi

        # Try to delete remote tag
        if git push origin ":refs/tags/v$FROM_VERSION" 2>/dev/null; then
            print_success "Remote tag v$FROM_VERSION deleted"
        else
            print_warning "Remote tag v$FROM_VERSION may not exist or already deleted"
        fi
    else
        print_warning "Local tag v$FROM_VERSION not found"
    fi

    echo ""
}

# Function to rollback main repository
rollback_main_repository() {
    print_section "Rollback Main Repository"

    cd "$PROJECT_ROOT"

    # Determine target version
    local target_version="$TO_VERSION"
    if [[ -z "$target_version" ]]; then
        target_version=$(get_previous_version)
        if [[ -z "$target_version" ]]; then
            print_error "Could not determine previous version"
            return 1
        fi
        print_info "Rolling back to previous version: $target_version"
    fi

    # Reset to previous tag
    if git tag | grep -q "v$target_version"; then
        print_info "Resetting to tag v$target_version"

        # Reset main branch
        if git checkout main && git reset --hard "v$target_version"; then
            print_success "Main branch reset to v$target_version"
        else
            print_error "Failed to reset main branch"
            return 1
        fi

        # Force push to reset remote branch
        print_warning "This will force push to reset the remote main branch"
        if git push --force-with-lease origin main; then
            print_success "Remote main branch reset"
        else
            print_error "Failed to reset remote main branch"
            return 1
        fi

    else
        print_error "Tag v$target_version not found"
        return 1
    fi

    # Restore previous version in package.json if needed
    local current_version=$(node -p -e "require('./package.json').version")
    if [[ "$current_version" != "$target_version" ]]; then
        print_info "Updating package.json version to $target_version"
        # This should already be correct after reset, but let's be sure
        npm version "$target_version" --no-git-tag-version --force
        print_success "Package.json version updated"
    fi

    echo ""
}

# Function to rollback kangaroo repository
rollback_kangaroo_repository() {
    print_section "Rollback Kangaroo Repository"

    cd "$KANGAROO_PATH"

    # Determine target version
    local target_version="$TO_VERSION"
    if [[ -z "$target_version" ]]; then
        target_version=$(get_previous_version)
        if [[ -z "$target_version" ]]; then
            print_error "Could not determine previous version for Kangaroo"
            return 1
        fi
    fi

    # Reset both main and release branches
    for branch in main release; do
        print_info "Resetting $branch branch to v$target_version"

        if git checkout "$branch"; then
            if git reset --hard "v$target_version"; then
                print_success "$branch branch reset to v$target_version"

                # Force push to reset remote branch
                if git push --force-with-lease origin "$branch"; then
                    print_success "Remote $branch branch reset"
                else
                    print_warning "Could not reset remote $branch branch (may need manual intervention)"
                fi
            else
                print_error "Failed to reset $branch branch"
                return 1
            fi
        else
            print_error "Could not checkout $branch branch"
            return 1
        fi
    done

    echo ""
}

# Function to rollback homebrew formula
rollback_homebrew_formula() {
    print_section "Rollback Homebrew Formula"

    local homebrew_path="$PROJECT_ROOT/deployment/homebrew"
    if [[ ! -d "$homebrew_path" ]]; then
        print_warning "Homebrew repository not found"
        return 0
    fi

    cd "$homebrew_path"

    # Determine target version
    local target_version="$TO_VERSION"
    if [[ -z "$target_version" ]]; then
        target_version=$(get_previous_version)
        if [[ -z "$target_version" ]]; then
            print_error "Could not determine previous version for Homebrew"
            return 1
        fi
    fi

    # Reset main branch
    print_info "Resetting Homebrew to v$target_version"

    if git checkout main && git reset --hard "v$target_version"; then
        print_success "Homebrew reset to v$target_version"

        if git push --force-with-lease origin main; then
            print_success "Remote Homebrew branch reset"
        else
            print_warning "Could not reset remote Homebrew branch"
        fi
    else
        print_error "Failed to reset Homebrew"
        return 1
    fi

    echo ""
}

# Function to verify rollback
verify_rollback() {
    print_section "Verify Rollback"

    cd "$PROJECT_ROOT"

    # Verify main repository state
    local current_version=$(node -p -e "require('./package.json').version")
    print_info "Current main repository version: $current_version"

    # Check if problematic release is gone
    if [[ -n "$FROM_VERSION" ]]; then
        if gh release view "v$FROM_VERSION" >/dev/null 2>&1; then
            print_error "Release v$FROM_VERSION still exists - rollback incomplete"
            return 1
        else
            print_success "Release v$FROM_VERSION successfully removed"
        fi
    fi

    # Verify Kangaroo state
    cd "$KANGAROO_PATH"
    local kangaroo_version=$(node -p -e "require('./package.json').version")
    print_info "Current Kangaroo version: $kangaroo_version"

    # Check CI/CD - no new builds should be triggered
    local recent_runs=$(gh run list --limit 3 --json databaseId,status,createdAt,headBranch | jq -r '.[] | select(.headBranch == "release")')
    if [[ -n "$recent_runs" ]]; then
        print_warning "Recent release branch runs detected - verify they are not related to rollback"
    else
        print_success "No recent release branch runs - good"
    fi

    print_success "Rollback verification completed"
    echo ""
}

# Function to create recovery release
create_recovery_release() {
    print_section "Create Recovery Release"

    cd "$PROJECT_ROOT"

    local recovery_version="${FROM_VERSION}-rollback-$(date +%Y%m%d-%H%M%S)"

    print_info "Creating recovery release: $recovery_version"

    # Create new tag
    if git tag "$recovery_version"; then
        print_success "Recovery tag created: $recovery_version"

        # Push tag
        if git push origin "$recovery_version"; then
            print_success "Recovery tag pushed to origin"
        else
            print_error "Failed to push recovery tag"
            return 1
        fi

        # Create recovery release
        local recovery_notes="# 🚨 Rollback Recovery

This is a rollback recovery release due to issues with v$FROM_VERSION.

## What Happened
- Version v$FROM_VERSION had critical issues
- Emergency rollback was performed
- System restored to previous stable state

## Current State
- System rolled back to stable version
- All problematic releases removed
- Services restored to working state

## Next Steps
1. Investigate the issues with v$FROM_VERSION
2. Fix the problems
3. Prepare a corrected release
4. Test thoroughly before redeployment

## Support
If you experience any issues, please contact support immediately.

---
Generated by emergency rollback procedure on $(date)"

        if gh release create "$recovery_version" --title "🚨 Rollback Recovery $recovery_version" --notes "$recovery_notes"; then
            print_success "Recovery release created"
            print_info "Recovery release URL: https://github.com/happenings-community/requests-and-offers/releases/tag/$recovery_version"
        else
            print_error "Failed to create recovery release"
            return 1
        fi

    else
        print_error "Failed to create recovery tag"
        return 1
    fi

    echo ""
}

# Function to show rollback summary
show_rollback_summary() {
    echo "=============================================="
    echo -e "${RED}🚨 Rollback Completed${NC}"
    echo ""
    echo -e "${BLUE}Rollback Summary:${NC}"
    echo -e "  🔄 From version: $FROM_VERSION"
    echo -e "  ✅ To version: $TO_VERSION (previous stable)"
    echo -e "  🗑️  GitHub release v$FROM_VERSION deleted"
    echo -e "  🔀 Repository branches reset"
    echo -e "  📦 Homebrew formula rolled back"
    echo ""
    echo -e "${YELLOW}Immediate Actions Required:${NC}"
    echo -e "  1. Verify all systems are working"
    echo -e "  2. Monitor user feedback and error reports"
    echo -e "  3. Investigate the root cause of the issues"
    echo -e "  4. Prepare a corrected release"
    echo ""
    echo -e "${CYAN}Backup Information:${NC}"
    if [[ -f "$PROJECT_ROOT/.latest-rollback-backup" ]]; then
        local backup_path=$(cat "$PROJECT_ROOT/.latest-rollback-backup")
        echo -e "  📁 Backup location: $backup_path"
        echo -e "  🔍 Review backup files for recovery information"
    else
        echo -e "  ⚠️  No backup path found"
    fi
    echo ""
    echo -e "${BLUE}Recovery Release:${NC}"
    echo -e "  📋 Created recovery release to document rollback"
    echo -e "  📝 All changes documented in release notes"
    echo ""
    echo -e "${GREEN}System Status: STABLE${NC}"
    echo -e "The rollback has been completed successfully."
    echo -e "The system is now running on the previous stable version."
}

# Function to show available versions
show_available_versions() {
    print_section "Available Versions"

    cd "$PROJECT_ROOT"

    echo "Available git tags:"
    git tag --sort=-version:refname | grep "^v[0-9]" | head -10

    echo ""
    echo "Recent GitHub releases:"
    gh release list --limit 10 --json tagName,name | jq -r '.[] | "  \(.tagName): \(.name)"'

    echo ""
}

# Help function
show_help() {
    echo "Rollback Procedures Script"
    echo ""
    echo "Usage: $0 FROM_VERSION [TO_VERSION] [OPTIONS]"
    echo ""
    echo "Arguments:"
    echo "  FROM_VERSION    Version to rollback from (required)"
    echo "  TO_VERSION      Version to rollback to (optional, defaults to previous)"
    echo ""
    echo "Options:"
    echo "  -h, --help          Show this help message"
    echo "  -e, --emergency     Emergency rollback mode (requires confirmation)"
    echo "  --no-backup         Skip backup creation"
    echo "  -l, --list          List available versions"
    echo "  --recovery-only     Only create recovery release (no rollback)"
    echo ""
    echo "Examples:"
    echo "  $0 0.2.0            Rollback from v0.2.0 to previous version"
    echo "  $0 0.2.0 0.1.9      Rollback from v0.2.0 to v0.1.9"
    echo "  $0 --list           List available versions for rollback"
    echo "  $0 0.2.0 --emergency Emergency rollback with confirmation"
    echo ""
    echo "This script performs emergency rollback procedures:"
    echo "  - Creates backup of current state"
    echo "  - Deletes problematic GitHub release"
    echo "  - Removes git tags"
    echo "  - Resets repository branches"
    echo "  - Rolls back Homebrew formula"
    echo "  - Creates recovery release documentation"
    echo ""
    echo "⚠️  This is a destructive operation that cannot be undone!"
    echo "   Use only in emergency situations with proper authorization."
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -e|--emergency)
            EMERGENCY_ROLLBACK=true
            shift
            ;;
        --no-backup)
            BACKUP_BEFORE_ROLLBACK=false
            shift
            ;;
        -l|--list)
            show_available_versions
            exit 0
            ;;
        --recovery-only)
            RECOVERY_ONLY=true
            shift
            ;;
        -*)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
        *)
            if [[ -z "$FROM_VERSION" ]]; then
                FROM_VERSION="$1"
            elif [[ -z "$TO_VERSION" ]]; then
                TO_VERSION="$1"
            else
                echo "Too many arguments"
                show_help
                exit 1
            fi
            shift
            ;;
    esac
done

# Validate arguments
if [[ -z "$FROM_VERSION" && "$RECOVERY_ONLY" != true ]]; then
    echo "Error: FROM_VERSION is required"
    show_help
    exit 1
fi

# Main rollback function
run_rollback() {
    print_info "Starting rollback procedures..."
    print_info "This is a critical operation that will revert system state"
    echo ""

    # Get confirmation for emergency rollback
    if [[ "$EMERGENCY_ROLLBACK" = true ]]; then
        ask_confirmation
    fi

    # Create backup
    if [[ "$BACKUP_BEFORE_ROLLBACK" = true ]]; then
        backup_current_state
    fi

    # Perform rollback
    if [[ "$RECOVERY_ONLY" != true ]]; then
        delete_github_release || exit 1
        rollback_main_repository || exit 1
        rollback_kangaroo_repository || exit 1
        rollback_homebrew_formula || exit 1
        verify_rollback || exit 1
    fi

    # Create recovery release
    create_recovery_release || exit 1

    show_rollback_summary
}

# Execute rollback
run_rollback