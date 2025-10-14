#!/bin/bash

# validation.sh - Comprehensive validation utilities for deployment
# Provides health checks, validation, and rollback capabilities

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" >&2
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" >&2
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" >&2
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

log_json() {
    local status="$1"
    local message="$2"
    local data="${3:-}"
    
    if [[ "${JSON_OUTPUT:-false}" == "true" ]]; then
        echo "{\"status\":\"$status\",\"message\":\"$message\",\"data\":$data,\"timestamp\":\"$(date -Iseconds)\"}"
    fi
}

# Load configuration
load_config() {
    local config_file="${1:-$(dirname "${BASH_SOURCE[0]}")/../config/deployment.json}"
    
    if [[ ! -f "$config_file" ]]; then
        log_error "Configuration file not found: $config_file"
        exit 1
    fi
    
    export CONFIG_FILE="$config_file"
    log_info "Loaded configuration from: $config_file"
}

# Get configuration value using jq
get_config() {
    local path="$1"
    jq -r "$path" "$CONFIG_FILE"
}

# Initialize or update git submodules
initialize_submodules() {
    log_info "Initializing git submodules..."

    local main_path
    main_path=$(get_config '.repositories.main.path')

    pushd "$main_path" > /dev/null

    # Initialize submodules if not already done
    if ! git submodule status &> /dev/null; then
        log_error "Git submodules not properly configured"
        popd > /dev/null
        return 1
    fi

    # Update submodules to latest
    if ! git submodule update --init --recursive; then
        log_error "Failed to update git submodules"
        popd > /dev/null
        return 1
    fi

    popd > /dev/null

    log_success "Git submodules initialized and updated"
    log_json "success" "Submodules initialized" "null"
}

# Validate environment prerequisites
validate_environment() {
    log_info "Validating environment prerequisites..."

    local required_tools=("git" "gh" "jq" "curl" "bun" "cargo")
    local missing_tools=()

    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            missing_tools+=("$tool")
        fi
    done

    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        log_json "error" "Missing required tools" "[\"$(IFS='","'; echo "${missing_tools[*]}")\"]"
        return 1
    fi

    # Check GitHub CLI authentication
    if ! gh auth status &> /dev/null; then
        log_error "GitHub CLI not authenticated. Run: gh auth login"
        log_json "error" "GitHub CLI not authenticated" "null"
        return 1
    fi

    # Validate repository paths exist
    local main_path
    main_path=$(get_config '.repositories.main.path')
    if [[ ! -d "$main_path" ]]; then
        log_error "Main repository path not found: $main_path"
        log_json "error" "Main repository path not found" "{\"path\":\"$main_path\"}"
        return 1
    fi

    # Initialize and validate submodules
    if ! initialize_submodules; then
        log_error "Submodule initialization failed"
        return 1
    fi

    # Validate submodule paths exist
    local kangaroo_path
    kangaroo_path=$(get_config '.repositories.kangaroo.path')
    if [[ ! -d "$kangaroo_path" ]]; then
        log_error "Kangaroo submodule path not found: $kangaroo_path"
        log_json "error" "Kangaroo submodule path not found" "{\"path\":\"$kangaroo_path\"}"
        return 1
    fi

    local homebrew_path
    homebrew_path=$(get_config '.repositories.homebrew.path')
    if [[ ! -d "$homebrew_path" ]]; then
        log_error "Homebrew submodule path not found: $homebrew_path"
        log_json "error" "Homebrew submodule path not found" "{\"path\":\"$homebrew_path\"}"
        return 1
    fi

    log_success "Environment validation passed"
    log_json "success" "Environment validation passed" "null"
    return 0
}

# Validate version format
validate_version() {
    local version="$1"
    
    if [[ ! "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$ ]]; then
        log_error "Invalid version format: $version (expected: x.y.z or x.y.z-suffix)"
        log_json "error" "Invalid version format" "{\"version\":\"$version\"}"
        return 1
    fi
    
    log_success "Version format valid: $version"
    log_json "success" "Version format valid" "{\"version\":\"$version\"}"
    return 0
}

# Check if version already exists
check_version_exists() {
    local version="$1"
    local repo_owner="$2"
    local repo_name="$3"
    
    if gh release view "v$version" --repo "$repo_owner/$repo_name" &> /dev/null; then
        log_warning "Version $version already exists in $repo_owner/$repo_name"
        log_json "warning" "Version already exists" "{\"version\":\"$version\",\"repo\":\"$repo_owner/$repo_name\"}"
        return 0
    else
        log_info "Version $version is available in $repo_owner/$repo_name"
        log_json "info" "Version is available" "{\"version\":\"$version\",\"repo\":\"$repo_owner/$repo_name\"}"
        return 1
    fi
}

# Validate webapp build
validate_webapp_build() {
    local main_path
    main_path=$(get_config '.repositories.main.path')
    local webapp_filename
    webapp_filename=$(get_config '.build.webapp_filename')
    
    log_info "Validating webapp build..."
    
    # Check if webapp file exists
    if [[ ! -f "$main_path/workdir/$webapp_filename" ]]; then
        log_error "WebApp file not found: $main_path/workdir/$webapp_filename"
        log_json "error" "WebApp file not found" "{\"path\":\"$main_path/workdir/$webapp_filename\"}"
        return 1
    fi
    
    # Validate webapp file is not empty and is a valid zip
    local file_size
    file_size=$(stat -c%s "$main_path/workdir/$webapp_filename")
    
    if [[ "$file_size" -lt 1000 ]]; then
        log_error "WebApp file appears to be too small: $file_size bytes"
        log_json "error" "WebApp file too small" "{\"size\":$file_size}"
        return 1
    fi
    
    # Test webapp file integrity (webhapps are gzip compressed, not ZIP)
    if ! gzip -t "$main_path/workdir/$webapp_filename" &> /dev/null; then
        log_error "WebApp file appears to be corrupted"
        log_json "error" "WebApp file corrupted" "null"
        return 1
    fi
    
    log_success "WebApp validation passed (size: $file_size bytes)"
    log_json "success" "WebApp validation passed" "{\"size\":$file_size}"
    return 0
}

# Validate GitHub release assets
validate_release_assets() {
    local version="$1"
    local repo_owner="$2"
    local repo_name="$3"
    
    log_info "Validating release assets for $repo_owner/$repo_name v$version..."
    
    # Get required assets from config
    local required_assets
    readarray -t required_assets < <(get_config '.validation.required_assets[]' | sed "s/{version}/$version/g")
    
    local missing_assets=()
    
    for asset in "${required_assets[@]}"; do
        if ! gh release view "v$version" --repo "$repo_owner/$repo_name" --json assets -q ".assets[].name" | grep -q "^$asset$"; then
            missing_assets+=("$asset")
        fi
    done
    
    if [[ ${#missing_assets[@]} -gt 0 ]]; then
        log_error "Missing release assets: ${missing_assets[*]}"
        log_json "error" "Missing release assets" "[\"$(IFS='","'; echo "${missing_assets[*]}")\"]"
        return 1
    fi
    
    log_success "All required assets present"
    log_json "success" "All required assets present" "null"
    return 0
}

# Test download links
test_download_links() {
    local version="$1"
    local repo_owner="$2"
    local repo_name="$3"
    
    log_info "Testing download links for $repo_owner/$repo_name v$version..."
    
    local base_url="https://github.com/$repo_owner/$repo_name/releases/download/v$version"
    local required_assets
    readarray -t required_assets < <(get_config '.validation.required_assets[]' | sed "s/{version}/$version/g")
    
    local failed_downloads=()
    
    for asset in "${required_assets[@]}"; do
        local url="$base_url/$asset"
        
        # Test with HEAD request
        if ! curl -sf --head "$url" &> /dev/null; then
            failed_downloads+=("$asset")
        fi
    done
    
    if [[ ${#failed_downloads[@]} -gt 0 ]]; then
        log_error "Failed download links: ${failed_downloads[*]}"
        log_json "error" "Failed download links" "[\"$(IFS='","'; echo "${failed_downloads[*]}")\"]"
        return 1
    fi
    
    log_success "All download links working"
    log_json "success" "All download links working" "null"
    return 0
}

# Wait for GitHub Actions build completion
wait_for_build() {
    local repo_owner="$1"
    local repo_name="$2"
    local timeout_minutes="${3:-15}"
    
    log_info "Waiting for build completion in $repo_owner/$repo_name (timeout: ${timeout_minutes}m)..."
    
    local start_time
    start_time=$(date +%s)
    local timeout_seconds=$((timeout_minutes * 60))
    
    while true; do
        local current_time
        current_time=$(date +%s)
        local elapsed=$((current_time - start_time))
        
        if [[ $elapsed -gt $timeout_seconds ]]; then
            log_error "Build timeout after ${timeout_minutes} minutes"
            log_json "error" "Build timeout" "{\"timeout_minutes\":$timeout_minutes}"
            return 1
        fi
        
        # Get latest workflow run status
        local run_status
        run_status=$(gh run list --repo "$repo_owner/$repo_name" --limit 1 --json status,conclusion -q '.[0] | "\(.status),\(.conclusion)"')
        
        local status="${run_status%,*}"
        local conclusion="${run_status#*,}"
        
        case "$status" in
            "completed")
                if [[ "$conclusion" == "success" ]]; then
                    log_success "Build completed successfully"
                    log_json "success" "Build completed successfully" "null"
                    return 0
                else
                    log_error "Build failed with conclusion: $conclusion"
                    log_json "error" "Build failed" "{\"conclusion\":\"$conclusion\"}"
                    return 1
                fi
                ;;
            "in_progress"|"queued")
                log_info "Build in progress... (${elapsed}s elapsed)"
                sleep 30
                ;;
            *)
                log_error "Unknown build status: $status"
                log_json "error" "Unknown build status" "{\"status\":\"$status\"}"
                return 1
                ;;
        esac
    done
}

# Create backup before deployment
create_backup() {
    local version="$1"
    local backup_dir="/tmp/deployment-backup-$(date +%Y%m%d-%H%M%S)"
    
    log_info "Creating backup: $backup_dir"
    
    mkdir -p "$backup_dir"
    
    # Backup current versions from each repo
    local main_path
    main_path=$(get_config '.repositories.main.path')
    local kangaroo_path
    kangaroo_path=$(get_config '.repositories.kangaroo.path')
    local homebrew_path
    homebrew_path=$(get_config '.repositories.homebrew.path')
    
    # Backup package.json versions and key files
    cp "$main_path/package.json" "$backup_dir/main-package.json" 2>/dev/null || true
    cp "$kangaroo_path/package.json" "$backup_dir/kangaroo-package.json" 2>/dev/null || true
    cp "$kangaroo_path/kangaroo.config.ts" "$backup_dir/kangaroo.config.ts" 2>/dev/null || true
    cp "$homebrew_path/Casks/requests-and-offers.rb" "$backup_dir/requests-and-offers.rb" 2>/dev/null || true
    
    echo "$backup_dir" > "/tmp/latest-deployment-backup"
    
    log_success "Backup created: $backup_dir"
    log_json "success" "Backup created" "{\"path\":\"$backup_dir\"}"
    
    export BACKUP_DIR="$backup_dir"
}

# Restore from backup
restore_backup() {
    local backup_dir="${1:-$(cat /tmp/latest-deployment-backup 2>/dev/null)}"
    
    if [[ -z "$backup_dir" || ! -d "$backup_dir" ]]; then
        log_error "No backup directory found: $backup_dir"
        log_json "error" "No backup directory found" "{\"path\":\"$backup_dir\"}"
        return 1
    fi
    
    log_info "Restoring from backup: $backup_dir"
    
    local main_path
    main_path=$(get_config '.repositories.main.path')
    local kangaroo_path
    kangaroo_path=$(get_config '.repositories.kangaroo.path')
    local homebrew_path
    homebrew_path=$(get_config '.repositories.homebrew.path')
    
    # Restore files
    [[ -f "$backup_dir/main-package.json" ]] && cp "$backup_dir/main-package.json" "$main_path/package.json"
    [[ -f "$backup_dir/kangaroo-package.json" ]] && cp "$backup_dir/kangaroo-package.json" "$kangaroo_path/package.json"
    [[ -f "$backup_dir/kangaroo.config.ts" ]] && cp "$backup_dir/kangaroo.config.ts" "$kangaroo_path/kangaroo.config.ts"
    [[ -f "$backup_dir/requests-and-offers.rb" ]] && cp "$backup_dir/requests-and-offers.rb" "$homebrew_path/Casks/requests-and-offers.rb"
    
    log_success "Backup restored"
    log_json "success" "Backup restored" "{\"path\":\"$backup_dir\"}"
}

# Cleanup old backups
cleanup_backups() {
    local backup_pattern="/tmp/deployment-backup-*"
    local keep_count="${1:-5}"
    
    log_info "Cleaning up old backups (keeping last $keep_count)..."
    
    # Remove backups older than 7 days, keeping at least $keep_count most recent
    find /tmp -maxdepth 1 -name "deployment-backup-*" -type d -mtime +7 | \
        head -n -"$keep_count" | \
        xargs rm -rf
    
    log_success "Backup cleanup completed"
}

# Main validation orchestrator
main() {
    local command="${1:-help}"
    
    case "$command" in
        "environment")
            load_config
            validate_environment
            ;;
        "submodules")
            load_config
            initialize_submodules
            ;;
        "version")
            validate_version "$2"
            ;;
        "webapp")
            load_config
            validate_webapp_build
            ;;
        "assets")
            validate_release_assets "$2" "$3" "$4"
            ;;
        "downloads")
            load_config
            test_download_links "$2" "$3" "$4"
            ;;
        "build")
            wait_for_build "$2" "$3" "${4:-15}"
            ;;
        "backup")
            load_config
            create_backup "$2"
            ;;
        "restore")
            load_config
            restore_backup "${2:-}"
            ;;
        "cleanup")
            cleanup_backups "${2:-5}"
            ;;
        "help"|*)
            echo "Usage: $0 <command> [args...]"
            echo ""
            echo "Commands:"
            echo "  environment                     - Validate environment prerequisites"
            echo "  submodules                     - Initialize/update git submodules"
            echo "  version <version>              - Validate version format"
            echo "  webapp                         - Validate webapp build"
            echo "  assets <version> <owner> <repo> - Validate release assets"
            echo "  downloads <version> <owner> <repo> - Test download links"
            echo "  build <owner> <repo> [timeout] - Wait for build completion"
            echo "  backup <version>               - Create deployment backup"
            echo "  restore [backup_dir]           - Restore from backup"
            echo "  cleanup [keep_count]           - Cleanup old backups"
            echo ""
            echo "Environment variables:"
            echo "  JSON_OUTPUT=true              - Enable JSON output mode"
            ;;
    esac
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi