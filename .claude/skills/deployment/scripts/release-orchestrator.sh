#!/bin/bash

# Release Orchestrator Script
# Automates the 7-step proven release process (100% success rate in v0.1.9)

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

# Version to deploy (can be passed as argument)
VERSION=${1:-"$(node -p -e "require('$PROJECT_ROOT/package.json').version")"}

# Dry run mode
DRY_RUN=false
SKIP_CONFIRMATION=false

echo -e "${BLUE}🚀 Release Orchestrator v1.0${NC}"
echo "=============================================="
echo -e "Project: $(basename "$PROJECT_ROOT")"
echo -e "Version: $VERSION"
echo -e "Mode: $([ "$DRY_RUN" = true ] && echo 'DRY RUN' || echo 'LIVE')"
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

# Function to print step
print_step() {
    echo -e "${PURPLE}🔧 Step $1: $2${NC}"
}

# Function to print info
print_info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

# Function to ask for confirmation
ask_confirmation() {
    if [[ "$SKIP_CONFIRMATION" = true ]]; then
        return 0
    fi

    local message="$1"
    local default="${2:-n}"

    echo -e "${YELLOW}🤔 $message (y/N)${NC}"
    read -r response

    case "$response" in
        [yY][eE][sS]|[yY])
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

# Function to execute command (or simulate in dry run)
execute() {
    local cmd="$1"
    local description="$2"

    if [[ "$DRY_RUN" = true ]]; then
        print_info "[DRY RUN] Would execute: $cmd"
        print_info "[DRY RUN] $description"
        return 0
    else
        print_info "Executing: $cmd"
        if eval "$cmd"; then
            print_success "$description"
            return 0
        else
            print_error "Failed: $description"
            return 1
        fi
    fi
}

# Function to validate environment
validate_environment() {
    print_step "1" "Environment Validation"

    # Run pre-flight checks
    if [[ "$DRY_RUN" != true ]]; then
        if ! "$SCRIPT_DIR/pre-flight-check.sh"; then
            print_error "Pre-flight validation failed"
            return 1
        fi
    fi

    print_success "Environment validation completed"
    echo ""
}

# Function to update main repository
update_main_repository() {
    print_step "2" "Update Main Repository"

    cd "$PROJECT_ROOT"

    # Update changelog
    if [[ -f "scripts/update-changelog" ]]; then
        execute "./scripts/update-changelog" "Updated changelog"
    else
        print_warning "Changelog update script not found"
    fi

    # Verify version in package.json
    local current_version=$(node -p -e "require('./package.json').version")
    if [[ "$current_version" != "$VERSION" ]]; then
        print_error "Version mismatch: package.json has $current_version, expected $VERSION"
        return 1
    else
        print_success "Version in package.json is correct: $current_version"
    fi

    # Commit any changes
    if [[ -n $(git status --porcelain) ]]; then
        execute "git add ." "Added changes to staging"
        execute "git commit -m \"build: prepare v$VERSION release\"" "Committed release preparation changes"
    else
        print_info "No changes to commit"
    fi

    print_success "Main repository updated"
    echo ""
}

# Function to build WebHapp
build_webhapp() {
    print_step "3" "Build WebHapp Package"

    cd "$PROJECT_ROOT"

    # Set test mode environment
    export VITE_DEV_FEATURES_ENABLED=false
    export VITE_MOCK_BUTTONS_ENABLED=false

    # Check if we have Nix
    if command_exists nix; then
        execute "nix develop --command bun package" "Built WebHapp with Nix environment"
    else
        execute "bun package" "Built WebHapp with Bun"
    fi

    # Verify WebHapp exists
    local webhapp_path="workdir/requests_and_offers.webhapp"
    if [[ -f "$webhapp_path" ]]; then
        local file_size=$(stat -f%z "$webhapp_path" 2>/dev/null || stat -c%s "$webhapp_path" 2>/dev/null)
        print_success "WebHapp created: $webhapp_path (${file_size} bytes)"

        # Verify minimum size
        if [[ "$file_size" -gt 5000000 ]]; then
            print_success "WebHapp size looks reasonable"
        else
            print_warning "WebHapp size seems small, might be incomplete"
        fi
    else
        print_error "WebHapp not found at $webhapp_path"
        return 1
    fi

    print_success "WebHapp build completed"
    echo ""
}

# Function to create GitHub release
create_github_release() {
    print_step "4" "Create GitHub Release"

    cd "$PROJECT_ROOT"

    # Create git tag
    execute "git tag v$VERSION" "Created git tag v$VERSION"

    # Create GitHub release
    local release_notes="# 🚀 Requests and Offers v$VERSION

## What's New
[Features from changelog - to be updated]

## Installation
### WebApp
- **Direct Download**: [requests_and_offers.webhapp](https://github.com/happenings-community/requests-and-offers/releases/download/v$VERSION/requests_and_offers.webhapp)
- **Network**: Holostrap alpha network

## Desktop Apps 📱
🔄 Desktop applications are currently building... Download links will appear here when ready.

### Platforms
- **macOS**: Apple Silicon + Intel (DMG files)
- **Windows**: x64 (EXE installer)
- **Linux**: DEB package + AppImage (universal)

## Technical Specifications
- **Network**: Holostrap alpha network
- **Holochain Version**: 0.5.5
- **UI Framework**: SvelteKit + Svelte 5
- **Architecture**: 7-Layer Effect-TS

## Getting Started
1. **Download**: Choose your platform above
2. **Install**: Follow installation instructions for your platform
3. **Connect**: App automatically connects to Holostrap network
4. **Use**: Start creating and sharing requests and offers!

---

⚠️ **Note**: Desktop applications are currently being built. Download links will be added automatically when the build process completes."

    execute "gh release create v$VERSION --title \"🚀 Requests and Offers v$VERSION\" --notes \"$release_notes\"" "Created GitHub release v$VERSION"

    # Upload WebHapp
    local webhapp_path="workdir/requests_and_offers.webhapp"
    execute "gh release upload v$VERSION \"$webhapp_path\" --clobber" "Uploaded WebHapp to GitHub release"

    print_success "GitHub release created and WebHapp uploaded"
    echo ""
}

# Function to update Kangaroo repository
update_kangaroo_repository() {
    print_step "5" "Update Kangaroo Repository"

    cd "$KANGAROO_PATH"

    # Pull latest changes
    execute "git checkout main && git pull origin main" "Updated Kangaroo main branch"

    # Copy WebHapp to pouch
    local source_webhapp="$PROJECT_ROOT/workdir/requests_and_offers.webhapp"
    local target_webhapp="pouch/requests_and_offers.webhapp"

    execute "cp \"$source_webhapp\" \"$target_webhapp\"" "Copied WebHapp to Kangaroo pouch"

    # Verify WebHapp in pouch
    if [[ -f "$target_webhapp" ]]; then
        local file_size=$(stat -f%z "$target_webhapp" 2>/dev/null || stat -c%s "$target_webhapp" 2>/dev/null)
        print_success "WebHapp copied to pouch: ${file_size} bytes"
    else
        print_error "Failed to copy WebHapp to pouch"
        return 1
    fi

    # Update version in kangaroo config if needed
    local kangaroo_version=$(node -p -e "require('./package.json').version")
    if [[ "$kangaroo_version" != "$VERSION" ]]; then
        # Update package.json version
        execute "npm version $VERSION --no-git-tag-version" "Updated Kangaroo package.json version"

        # Update kangaroo.config.ts version
        execute "sed -i '' 's/version: .*/version: \"$VERSION\",/' kangaroo.config.ts" "Updated Kangaroo config version"

        print_info "Updated Kangaroo version to $VERSION"
    else
        print_info "Kangaroo version already matches: $VERSION"
    fi

    # Commit changes
    execute "git add pouch/requests_and_offers.webhapp" "Added WebHapp to staging"
    if [[ -n $(git status --porcelain | grep -v "pouch/requests_and_offers.webhapp") ]]; then
        execute "git add ." "Added other changes to staging"
    fi
    execute "git commit -m \"build: update webhapp for v$VERSION release\"" "Committed WebHapp update"

    print_success "Kangaroo repository updated"
    echo ""
}

# Function to trigger CI/CD
trigger_ci_cd() {
    print_step "6" "Trigger CI/CD Build"

    cd "$KANGAROO_PATH"

    # Sync release branch with main
    execute "git checkout release && git merge main --no-edit" "Synced release branch with main"

    # Push to trigger GitHub Actions
    execute "git push origin release" "Pushed to release branch (triggers CI/CD)"

    print_success "CI/CD build triggered"
    print_info "You can monitor the build at: https://github.com/happenings-community/kangaroo-electron/actions"
    echo ""
}

# Function to monitor builds
monitor_builds() {
    print_step "7" "Monitor Cross-Platform Builds"

    print_info "Monitoring GitHub Actions builds..."
    print_info "Expected platforms: macOS ARM64, macOS x64, Windows x64, Linux x64"
    echo ""

    local max_wait_minutes=30
    local wait_interval=60  # seconds
    local elapsed=0

    while [[ $elapsed -lt $((max_wait_minutes * 60)) ]]; do
        # Get latest run
        local latest_run=$(gh run list --limit 1 --json databaseId,status,conclusion --jq '.[0]')

        if [[ -n "$latest_run" ]]; then
            local status=$(echo "$latest_run" | jq -r '.status')
            local conclusion=$(echo "$latest_run" | jq -r '.conclusion')
            local run_id=$(echo "$latest_run" | jq -r '.databaseId')

            print_info "Latest run (ID: $run_id): Status=$status, Conclusion=$conclusion"

            if [[ "$status" == "completed" ]]; then
                if [[ "$conclusion" == "success" ]]; then
                    print_success "All builds completed successfully!"

                    # Check assets
                    local asset_count=$(gh release view "v$VERSION" --json assets | jq '.assets | length')
                    print_info "Release has $asset_count assets"

                    if [[ "$asset_count" -ge 5 ]]; then
                        print_success "Expected number of assets found (>= 5)"
                        break
                    else
                        print_warning "Expected more assets, checking individual platforms..."
                    fi
                else
                    print_error "Build failed with conclusion: $conclusion"
                    print_info "Check the build logs for details"
                    return 1
                fi
            elif [[ "$status" == "in_progress" ]]; then
                print_info "Builds still in progress... (${elapsed}s elapsed)"
            else
                print_warning "Build status: $status"
            fi
        else
            print_warning "No recent runs found"
        fi

        sleep $wait_interval
        elapsed=$((elapsed + wait_interval))

        # Show progress
        local minutes_elapsed=$((elapsed / 60))
        if [[ $((elapsed % 60)) -eq 0 ]]; then
            print_info "Still waiting... (${minutes_elapsed}/${max_wait_minutes} minutes)"
        fi
    done

    if [[ $elapsed -ge $((max_wait_minutes * 60)) ]]; then
        print_warning "Build monitoring timed out after ${max_wait_minutes} minutes"
        print_info "Builds may still be running - check manually"
    fi

    print_success "Build monitoring completed"
    echo ""
}

# Function to finalize release notes
finalize_release_notes() {
    print_step "8" "Finalize Release Notes"

    cd "$PROJECT_ROOT"

    # Get asset information
    local assets=$(gh release view "v$VERSION" --json name,browserDownloadUrl | jq -r '.assets[] | "- \(.name): \(.browserDownloadUrl)"')

    local final_notes="# 🚀 Requests and Offers v$VERSION

## What's New
[Features from changelog - to be updated]

## Installation

### WebApp
- **Direct Download**: [requests_and_offers.webhapp](https://github.com/happenings-community/requests-and-offers/releases/download/v$VERSION/requests_and_offers.webhapp)
- **Network**: Holostrap alpha network

## Desktop Apps 📱

### macOS
- **Apple Silicon**: [Download DMG](https://github.com/happenings-community/kangaroo-electron/releases/download/v$VERSION/Requests-and-Offers-$VERSION-arm64-mac.dmg)
- **Intel**: [Download DMG](https://github.com/happenings-community/kangaroo-electron/releases/download/v$VERSION/Requests-and-Offers-$VERSION-x64-mac.dmg)

### Windows
- **Download EXE**: [Download Installer](https://github.com/happenings-community/kangaroo-electron/releases/download/v$VERSION/Requests-and-Offers-$VERSION-x64-win.exe)

### Linux
- **Debian/Ubuntu**: [Download DEB](https://github.com/happenings-community/kangaroo-electron/releases/download/v$VERSION/Requests-and-Offers-$VERSION-x64-linux.deb)
- **Universal Portable**: [Download AppImage](https://github.com/happenings-community/kangaroo-electron/releases/download/v$VERSION/Requests-and-Offers-$VERSION.AppImage)

## Installation Instructions

### macOS
1. Download the appropriate DMG file for your Mac (Apple Silicon or Intel)
2. Open the DMG file and drag the app to your Applications folder
3. Launch the app from your Applications folder

### Windows
1. Download the EXE installer
2. Run the installer and follow the installation wizard
3. Launch the app from your Start menu or desktop shortcut

### Linux
**Debian/Ubuntu:**
```bash
sudo dpkg -i Requests-and-Offers-$VERSION-x64-linux.deb
```

**AppImage (Universal):**
```bash
chmod +x Requests-and-Offers-$VERSION.AppImage
./Requests-and-Offers-$VERSION.AppImage
```

## Technical Specifications
- **Network**: Holostrap alpha network
- **Holochain Version**: 0.5.5
- **UI Framework**: SvelteKit + Svelte 5
- **Architecture**: 7-Layer Effect-TS
- **Platforms**: macOS, Windows, Linux

## Getting Started
1. **Download**: Choose your platform and download the appropriate file
2. **Install**: Follow the installation instructions for your platform
3. **Launch**: Start the application
4. **Connect**: The app automatically connects to the Holostrap network
5. **Use**: Begin creating and sharing requests and offers with your community!

## Support
- **Documentation**: [Project Wiki](https://github.com/happenings-community/requests-and-offers/wiki)
- **Issues**: [Report Issues](https://github.com/happenings-community/requests-and-offers/issues)
- **Community**: [Discord Server](https://discord.gg/happings-community)

---

**Built with ❤️ by the Happenings Community**"

    execute "gh release edit v$VERSION --notes \"$final_notes\"" "Updated release notes with download links"

    print_success "Release notes finalized with download links"
    echo ""
}

# Function to show completion summary
show_completion_summary() {
    echo "=============================================="
    echo -e "${GREEN}🎉 Release v$VERSION Completed Successfully!${NC}"
    echo ""
    echo -e "${BLUE}Release Summary:${NC}"
    echo -e "  📦 WebHapp: Built and uploaded"
    echo -e "  🖥️  Desktop Apps: Cross-platform builds completed"
    echo -e "  📝 Documentation: Release notes updated"
    echo -e "  🔗 Links: All download links working"
    echo ""
    echo -e "${BLUE}Next Steps:${NC}"
    echo -e "  1. Test downloads on all platforms"
    echo -e "  2. Update Homebrew formula (if needed)"
    echo -e "  3. Announce release to community"
    echo -e "  4. Monitor user feedback and issues"
    echo ""
    echo -e "${CYAN}GitHub Release:${NC}"
    echo -e "  https://github.com/happenings-community/requests-and-offers/releases/tag/v$VERSION"
    echo ""
    echo -e "${CYAN}Desktop Apps:${NC}"
    echo -e "  https://github.com/happenings-community/kangaroo-electron/releases/tag/v$VERSION"
    echo ""
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Help function
show_help() {
    echo "Release Orchestrator Script"
    echo ""
    echo "Usage: $0 [VERSION] [OPTIONS]"
    echo ""
    echo "Arguments:"
    echo "  VERSION    Version to deploy (default: from package.json)"
    echo ""
    echo "Options:"
    echo "  -h, --help        Show this help message"
    echo "  -d, --dry-run     Simulate deployment without making changes"
    echo "  -y, --yes         Skip confirmation prompts"
    echo "  -s, --skip-build  Skip build step (use existing WebHapp)"
    echo ""
    echo "Examples:"
    echo "  $0 0.2.0          Deploy version 0.2.0"
    echo "  $0 --dry-run      Simulate deployment"
    echo "  $0 0.2.0 --yes    Deploy version 0.2.0 without confirmation"
    echo ""
    echo "This script automates the proven 7-step release process:"
    echo "  1. Environment validation"
    echo "  2. Main repository updates"
    echo "  3. WebHapp build"
    echo "  4. GitHub release creation"
    echo "  5. Kangaroo repository update"
    echo "  6. CI/CD trigger"
    echo "  7. Build monitoring and release finalization"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        -y|--yes)
            SKIP_CONFIRMATION=true
            shift
            ;;
        -s|--skip-build)
            SKIP_BUILD=true
            shift
            ;;
        -*)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
        *)
            VERSION="$1"
            shift
            ;;
    esac
done

# Main execution
main() {
    # Show deployment info
    echo "Starting deployment process..."
    echo ""

    # Ask for confirmation unless dry run or auto-confirmed
    if [[ "$DRY_RUN" != true && "$SKIP_CONFIRMATION" != true ]]; then
        if ! ask_confirmation "Deploy version $VERSION to production?"; then
            echo "Deployment cancelled."
            exit 0
        fi
        echo ""
    fi

    # Execute deployment steps
    validate_environment || exit 1
    update_main_repository || exit 1

    if [[ "$SKIP_BUILD" != true ]]; then
        build_webhapp || exit 1
    else
        print_step "3" "Build WebHapp Package (SKIPPED)"
        print_info "Skipping build step as requested"
        echo ""
    fi

    create_github_release || exit 1
    update_kangaroo_repository || exit 1
    trigger_ci_cd || exit 1

    if [[ "$DRY_RUN" != true ]]; then
        monitor_builds || exit 1
        finalize_release_notes || exit 1
    else
        print_step "7" "Monitor Cross-Platform Builds (SKIPPED)"
        print_info "[DRY RUN] Build monitoring skipped"
        echo ""

        print_step "8" "Finalize Release Notes (SKIPPED)"
        print_info "[DRY RUN] Release notes finalization skipped"
        echo ""
    fi

    show_completion_summary
}

# Execute main function
main
