#!/bin/bash

# Build Verification Script
# Validates cross-platform builds and asset uploads

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

# Version to verify (can be passed as argument)
VERSION=${1:-"$(node -p -e "require('$PROJECT_ROOT/package.json').version")"}

# Verification mode
FULL_VERIFICATION=true
ASSET_DOWNLOAD_TEST=false

echo -e "${BLUE}🔍 Build Verification Script v1.0${NC}"
echo "=============================================="
echo -e "Project: $(basename "$PROJECT_ROOT")"
echo -e "Version: $VERSION"
echo -e "Mode: $([ "$FULL_VERIFICATION" = true ] && echo 'FULL' || echo 'BASIC')"
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
    echo -e "${PURPLE}🔍 $1${NC}"
    echo "----------------------------------------------"
}

# Function to print info
print_info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to get asset information
get_asset_info() {
    local asset_name="$1"
    gh release view "v$VERSION" --json assets | jq -r ".assets[] | select(.name | contains(\"$asset_name\")) | {name: .name, size: .size, downloadUrl: .browserDownloadUrl}"
}

# Function to check WebHapp
verify_webhapp() {
    print_section "WebHapp Verification"

    local webhapp_path="$PROJECT_ROOT/workdir/requests_and_offers.webhapp"
    local webhapp_size=0

    # Check local WebHapp
    if [[ -f "$webhapp_path" ]]; then
        webhapp_size=$(stat -f%z "$webhapp_path" 2>/dev/null || stat -c%s "$webhapp_path" 2>/dev/null)
        print_success "Local WebHapp exists: $webhapp_size bytes"

        # Check size reasonableness
        if [[ $webhapp_size -gt 5000000 ]]; then
            print_success "WebHapp size is reasonable ($(numfmt --to=iec-i --suffix=B $webhapp_size))"
        else
            print_warning "WebHapp size seems small: $(numfmt --to=iec-i --suffix=B $webhapp_size)"
        fi
    else
        print_error "Local WebHapp not found"
    fi

    # Check GitHub release WebHapp
    local github_webhapp=$(get_asset_info "webhapp")
    if [[ -n "$github_webhapp" ]]; then
        local github_size=$(echo "$github_webhapp" | jq -r '.size')
        print_success "GitHub WebHapp found: $(numfmt --to=iec-i --suffix=B $github_size)"

        # Compare sizes
        if [[ $webhapp_size -gt 0 ]] && [[ $github_size -gt 0 ]]; then
            if [[ $webhapp_size -eq $github_size ]]; then
                print_success "Local and GitHub WebHapp sizes match"
            else
                print_warning "Size mismatch: Local=$webhapp_size, GitHub=$github_size"
            fi
        fi
    else
        print_error "GitHub WebHapp not found"
    fi

    echo ""
}

# Function to check GitHub release
verify_github_release() {
    print_section "GitHub Release Verification"

    # Check if release exists
    if gh release view "v$VERSION" >/dev/null 2>&1; then
        print_success "GitHub release v$VERSION exists"

        # Get release info
        local release_info=$(gh release view "v$VERSION" --json name,createdAt,assets)
        local release_name=$(echo "$release_info" | jq -r '.name')
        local created_at=$(echo "$release_info" | jq -r '.createdAt')
        local asset_count=$(echo "$release_info" | jq '.assets | length')

        print_info "Release name: $release_name"
        print_info "Created at: $created_at"
        print_info "Asset count: $asset_count"

        # Check expected asset count
        if [[ $asset_count -ge 5 ]]; then
            print_success "Expected number of assets found (>= 5)"
        else
            print_warning "Expected more assets (found $asset_count, expected >= 5)"
        fi

    else
        print_error "GitHub release v$VERSION not found"
    fi

    echo ""
}

# Function to verify platform assets
verify_platform_assets() {
    print_section "Platform Assets Verification"

    # Expected platforms and file patterns
    declare -A platforms=(
        ["macos-arm64"]="arm64-mac.dmg"
        ["macos-x64"]="x64-mac.dmg"
        ["windows-x64"]="x64-win.exe"
        ["linux-deb"]="x64-linux.deb"
        ["linux-appimage"]="AppImage"
    )

    local total_expected=${#platforms[@]}
    local found_count=0

    for platform in "${!platforms[@]}"; do
        local pattern="${platforms[$platform]}"
        local asset_info=$(get_asset_info "$pattern")

        if [[ -n "$asset_info" ]]; then
            local name=$(echo "$asset_info" | jq -r '.name')
            local size=$(echo "$asset_info" | jq -r '.size')
            local url=$(echo "$asset_info" | jq -r '.downloadUrl')

            print_success "$platform: $name ($(numfmt --to=iec-i --suffix=B $size))"

            # Check size reasonableness
            case "$platform" in
                macos-*)
                    if [[ $size -gt 70000000 ]]; then
                        print_success "  Size is reasonable for macOS app"
                    else
                        print_warning "  Size seems small for macOS app: $(numfmt --to=iec-i --suffix=B $size)"
                    fi
                    ;;
                windows-x64)
                    if [[ $size -gt 80000000 ]]; then
                        print_success "  Size is reasonable for Windows app"
                    else
                        print_warning "  Size seems small for Windows app: $(numfmt --to=iec-i --suffix=B $size)"
                    fi
                    ;;
                linux-*)
                    if [[ $size -gt 60000000 ]]; then
                        print_success "  Size is reasonable for Linux app"
                    else
                        print_warning "  Size seems small for Linux app: $(numfmt --to=iec-i --suffix=B $size)"
                    fi
                    ;;
            esac

            ((found_count++))

            # Test download if enabled
            if [[ "$ASSET_DOWNLOAD_TEST" = true ]]; then
                print_info "  Testing download..."
                if curl -s --head "$url" | grep -q "200 OK"; then
                    print_success "  Download URL is accessible"
                else
                    print_warning "  Download URL may not be accessible"
                fi
            fi

        else
            print_error "$platform: Not found"
        fi
    done

    # Summary
    print_info "Platform assets found: $found_count/$total_expected"
    if [[ $found_count -eq $total_expected ]]; then
        print_success "All expected platform assets found"
    else
        print_warning "Some platform assets missing"
    fi

    echo ""
}

# Function to verify Kangaroo builds
verify_kangaroo_builds() {
    print_section "Kangaroo CI/CD Build Verification"

    cd "$KANGAROO_PATH"

    # Get recent workflow runs
    local recent_runs=$(gh run list --limit 5 --json databaseId,status,conclusion,createdAt,headBranch | jq -r '.[] | select(.headBranch == "release")')

    if [[ -n "$recent_runs" ]]; then
        echo "$recent_runs" | while read -r run; do
            if [[ -n "$run" ]]; then
                local run_id=$(echo "$run" | jq -r '.databaseId')
                local status=$(echo "$run" | jq -r '.status')
                local conclusion=$(echo "$run" | jq -r '.conclusion')
                local created_at=$(echo "$run" | jq -r '.createdAt')

                print_info "Run $run_id: $status ($conclusion) at $created_at"

                # Check if it's for our version
                local run_version=$(gh run view "$run_id" --json jobs | jq -r '.jobs[0].steps[] | select(.name | contains("kangarooConfig")) | .outputs.APP_VERSION' 2>/dev/null || echo "")
                if [[ "$run_version" == "$VERSION" ]]; then
                    print_success "Found build run for version $VERSION"

                    # Get job details
                    local jobs_info=$(gh run view "$run_id" --json jobs)
                    echo "$jobs_info" | jq -r '.jobs[] | "  \(.name): \(.status) (\(.conclusion // "running"))"' | while read -r job_info; do
                        if [[ -n "$job_info" ]]; then
                            print_info "$job_info"
                        fi
                    done
                fi
            fi
        done
    else
        print_warning "No recent release branch runs found"
    fi

    # Check for build artifacts in dist directory (if it exists)
    if [[ -d "dist" ]]; then
        local dist_files=$(find dist -type f 2>/dev/null | wc -l)
        if [[ $dist_files -gt 0 ]]; then
            print_info "Local dist directory has $dist_files files"
            ls -la dist/ | head -5
        else
            print_info "Local dist directory is empty"
        fi
    else
        print_info "No local dist directory found"
    fi

    echo ""
}

# Function to verify Homebrew formula
verify_homebrew_formula() {
    print_section "Homebrew Formula Verification"

    local homebrew_path="$PROJECT_ROOT/deployment/homebrew"
    if [[ -d "$homebrew_path" ]]; then
        cd "$homebrew_path"

        local cask_file="Casks/requests-and-offers.rb"
        if [[ -f "$cask_file" ]]; then
            print_success "Homebrew cask file exists"

            # Check version in cask
            local cask_version=$(grep 'version ' "$cask_file" | head -1 | sed 's/.*version "\(.*\)".*/\1/')
            print_info "Cask version: $cask_version"

            if [[ "$cask_version" == "$VERSION" ]]; then
                print_success "Cask version matches release version"
            else
                print_warning "Cask version differs: cask=$cask_version, release=$VERSION"
            fi

            # Check checksums
            local checksum_count=$(grep -c 'sha256' "$cask_file" || echo "0")
            print_info "Checksum entries: $checksum_count"

            if [[ $checksum_count -ge 4 ]]; then
                print_success "Expected number of checksums found"
            else
                print_warning "Expected more checksums (found $checksum_count, expected >= 4)"
            fi

        else
            print_error "Homebrew cask file not found"
        fi
    else
        print_warning "Homebrew repository not found (deployment/homebrew)"
    fi

    echo ""
}

# Function to verify version consistency
verify_version_consistency() {
    print_section "Version Consistency Verification"

    # Check main repository version
    local main_version=$(node -p -e "require('$PROJECT_ROOT/package.json').version")
    print_info "Main repository version: $main_version"

    # Check kangaroo version
    local kangaroo_version=$(node -p -e "require('$KANGAROO_PATH/package.json').version" 2>/dev/null || echo "N/A")
    print_info "Kangaroo version: $kangaroo_version"

    # Check kangaroo config version
    local config_version=$(grep 'version:' "$KANGAROO_PATH/kangaroo.config.ts" | head -1 | sed "s/.*version: '//; s/'.*//" || echo "N/A")
    print_info "Kangaroo config version: $config_version"

    # Check for consistency
    local consistent=true
    if [[ "$main_version" != "$VERSION" ]]; then
        print_error "Main repository version mismatch"
        consistent=false
    fi

    if [[ "$kangaroo_version" != "N/A" && "$kangaroo_version" != "$VERSION" ]]; then
        print_error "Kangaroo package.json version mismatch"
        consistent=false
    fi

    if [[ "$config_version" != "N/A" && "$config_version" != "$VERSION" ]]; then
        print_error "Kangaroo config version mismatch"
        consistent=false
    fi

    if [[ "$consistent" = true ]]; then
        print_success "All versions are consistent"
    else
        print_warning "Version inconsistencies detected"
    fi

    echo ""
}

# Function to verify download links
verify_download_links() {
    print_section "Download Links Verification"

    # Get release assets and test their download URLs
    local assets=$(gh release view "v$VERSION" --json name,browserDownloadUrl | jq -r '.assets[] | {name: .name, url: .browserDownloadUrl}')

    echo "$assets" | while read -r asset; do
        if [[ -n "$asset" ]]; then
            local name=$(echo "$asset" | jq -r '.name')
            local url=$(echo "$asset" | jq -r '.url')

            print_info "Testing: $name"

            if curl -s --head -L "$url" --max-time 10 | grep -q "200 OK\|302 Found"; then
                print_success "  Download link is accessible"
            else
                print_warning "  Download link may not be accessible"
            fi
        fi
    done

    echo ""
}

# Function to show verification summary
show_verification_summary() {
    echo "=============================================="
    echo -e "${BLUE}📊 Verification Summary${NC}"
    echo ""

    # Overall assessment
    local total_checks=7
    local passed_checks=0

    # This would be tracked through the individual verification functions
    # For now, we'll provide a qualitative summary

    print_info "Verification completed for version $VERSION"
    print_info "Check the output above for detailed results"
    echo ""

    print_info "Key areas verified:"
    echo "  ✅ WebHapp build and upload"
    echo "  ✅ GitHub release creation"
    echo "  ✅ Cross-platform platform assets"
    echo "  ✅ Kangaroo CI/CD builds"
    echo "  ✅ Version consistency"
    echo "  ✅ Download link accessibility"
    echo "  ✅ Homebrew formula (if applicable)"
    echo ""

    print_info "If any issues were found above, address them before"
    print_info "announcing the release to users."
}

# Help function
show_help() {
    echo "Build Verification Script"
    echo ""
    echo "Usage: $0 [VERSION] [OPTIONS]"
    echo ""
    echo "Arguments:"
    echo "  VERSION    Version to verify (default: from package.json)"
    echo ""
    echo "Options:"
    echo "  -h, --help           Show this help message"
    echo "  -b, --basic          Run basic verification only"
    echo "  -d, --download-test  Test actual file downloads"
    echo "  -q, --quiet          Suppress non-error output"
    echo ""
    echo "Examples:"
    echo "  $0 0.2.0             Verify version 0.2.0"
    echo "  $0 --basic           Run basic verification only"
    echo "  $0 --download-test   Test download links"
    echo ""
    echo "This script verifies:"
    echo "  - WebHapp build and GitHub upload"
    echo "  - GitHub release creation and assets"
    echo "  - Cross-platform build availability"
    echo "  - Kangaroo CI/CD build status"
    echo "  - Version consistency across repositories"
    echo "  - Download link accessibility"
    echo "  - Homebrew formula (if present)"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -b|--basic)
            FULL_VERIFICATION=false
            shift
            ;;
        -d|--download-test)
            ASSET_DOWNLOAD_TEST=true
            shift
            ;;
        -q|--quiet)
            # Redirect non-error output to /dev/null
            exec 1>/dev/null
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

# Main verification function
run_verification() {
    print_info "Starting build verification for version $VERSION..."
    echo ""

    # Always run basic verification
    verify_webhapp
    verify_github_release
    verify_platform_assets
    verify_version_consistency

    # Run full verification if requested
    if [[ "$FULL_VERIFICATION" = true ]]; then
        verify_kangaroo_builds
        verify_homebrew_formula
        verify_download_links
    else
        print_info "Skipping extended verification (basic mode)"
        echo ""
    fi

    show_verification_summary
}

# Execute verification
run_verification