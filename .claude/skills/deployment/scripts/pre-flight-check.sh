#!/bin/bash

# Pre-flight Validation Script
# Validates environment and prerequisites before deployment

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
CONFIG_FILE="$PROJECT_ROOT/.claude/skills/deployment/templates/deployment-config.json"

echo -e "${BLUE}🚀 Pre-flight Deployment Validation${NC}"
echo "=============================================="

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

# Function to print info
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check git repository status
check_git_status() {
    local repo_path="$1"
    local repo_name="$2"

    print_info "Checking $repo_name git status..."

    cd "$repo_path"

    # Check for uncommitted changes
    if [[ -n $(git status --porcelain) ]]; then
        print_error "$repo_name has uncommitted changes"
        echo "Please commit or stash changes before deployment"
        git status --short
        return 1
    else
        print_success "$repo_name working directory is clean"
    fi

    # Check current branch
    local current_branch=$(git rev-parse --abbrev-ref HEAD)
    print_info "Current branch: $current_branch"

    # Check for remotes
    if git remote | grep -q "origin"; then
        print_success "$repo_name has origin remote"

        # Check if we can push
        local can_push=$(git ls-remote --exit-code origin HEAD 2>/dev/null && echo "yes" || echo "no")
        if [[ "$can_push" == "yes" ]]; then
            print_success "$repo_name can push to origin"
        else
            print_warning "$repo_name may not have push access to origin"
        fi
    else
        print_error "$repo_name has no origin remote"
        return 1
    fi

    cd "$PROJECT_ROOT"
}

# Function to check GitHub CLI
check_github_cli() {
    print_info "Checking GitHub CLI authentication..."

    if ! command_exists gh; then
        print_error "GitHub CLI (gh) is not installed"
        echo "Install it from: https://cli.github.com/"
        return 1
    fi

    # Check authentication
    if gh auth status >/dev/null 2>&1; then
        local auth_info=$(gh auth status)
        print_success "GitHub CLI is authenticated"

        # Extract logged in user
        local logged_in_user=$(echo "$auth_info" | grep "Logged in as" | head -1 | sed 's/.*Logged in as //')
        print_info "Logged in as: $logged_in_user"

        # Check GitHub Enterprise if applicable
        if echo "$auth_info" | grep -q "GitHub Enterprise"; then
            print_warning "Connected to GitHub Enterprise instance"
        fi

    else
        print_error "GitHub CLI is not authenticated"
        echo "Run: gh auth login"
        return 1
    fi
}

# Function to check submodules
check_submodules() {
    print_info "Checking git submodules..."

    cd "$PROJECT_ROOT"

    # Check if .gitmodules exists
    if [[ -f ".gitmodules" ]]; then
        print_success ".gitmodules file exists"

        # List submodules
        local submodule_count=$(git submodule status | wc -l)
        print_info "Found $submodule_count submodule(s)"

        # Check each submodule
        git submodule status | while read -r line; do
            local submodule_path=$(echo "$line" | awk '{print $2}')
            local submodule_status=$(echo "$line" | cut -c1)

            case "$submodule_status" in
                " ")
                    print_success "Submodule $submodule_path is up to date"
                    ;;
                "+")
                    print_warning "Submodule $submodule_path has new commits"
                    ;;
                "-")
                    print_error "Submodule $submodule_path is not initialized"
                    echo "Run: git submodule update --init --recursive"
                    return 1
                    ;;
                "U")
                    print_error "Submodule $submodule_path has merge conflicts"
                    return 1
                    ;;
            esac
        done

        # Try to update submodules
        print_info "Updating submodules..."
        if git submodule update --init --recursive --quiet; then
            print_success "Submodules updated successfully"
        else
            print_warning "Failed to update submodules (may be okay if already up to date)"
        fi

    else
        print_warning "No .gitmodules file found (no submodules)"
    fi

    cd "$PROJECT_ROOT"
}

# Function to check environment variables
check_environment() {
    print_info "Checking environment variables..."

    # Check for required environment variables
    local required_vars=("VITE_APP_ENV")
    local optional_vars=("VITE_DEV_FEATURES_ENABLED" "VITE_MOCK_BUTTONS_ENABLED")

    for var in "${required_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            print_warning "Environment variable $var is not set"
        else
            print_success "Environment variable $var is set to ${!var}"
        fi
    done

    for var in "${optional_vars[@]}"; do
        if [[ -n "${!var}" ]]; then
            print_success "Optional environment variable $var is set to ${!var}"
        fi
    done
}

# Function to check build dependencies
check_build_dependencies() {
    print_info "Checking build dependencies..."

    # Check Node.js
    if command_exists node; then
        local node_version=$(node --version)
        print_success "Node.js is installed: $node_version"

        # Check version
        local node_major=$(echo "$node_version" | sed 's/v//' | cut -d. -f1)
        if [[ "$node_major" -ge 16 ]]; then
            print_success "Node.js version is compatible (>= 16)"
        else
            print_warning "Node.js version may be too old (< 16)"
        fi
    else
        print_error "Node.js is not installed"
        return 1
    fi

    # Check Bun
    if command_exists bun; then
        local bun_version=$(bun --version)
        print_success "Bun is installed: $bun_version"
    else
        print_warning "Bun is not installed (recommended for this project)"
    fi

    # Check Nix (optional but recommended)
    if command_exists nix; then
        local nix_version=$(nix --version | head -1)
        print_success "Nix is available: $nix_version"
    else
        print_warning "Nix is not installed (recommended for Holochain development)"
    fi
}

# Function to check project structure
check_project_structure() {
    print_info "Checking project structure..."

    local required_files=(
        "package.json"
        "dnas/requests_and_offers/dna.yaml"
        "ui/package.json"
        "documentation/RELEASE_CHECKLIST.md"
    )

    local required_dirs=(
        "dnas"
        "ui"
        "deployment"
        "documentation"
    )

    # Check required files
    for file in "${required_files[@]}"; do
        if [[ -f "$file" ]]; then
            print_success "Required file exists: $file"
        else
            print_error "Required file missing: $file"
            return 1
        fi
    done

    # Check required directories
    for dir in "${required_dirs[@]}"; do
        if [[ -d "$dir" ]]; then
            print_success "Required directory exists: $dir"
        else
            print_error "Required directory missing: $dir"
            return 1
        fi
    done

    # Check kangaroo submodule
    local kangaroo_path="deployment/kangaroo-electron"
    if [[ -d "$kangaroo_path" ]]; then
        print_success "Kangaroo submodule directory exists"

        # Check kangaroo config
        local kangaroo_config="$kangaroo_path/kangaroo.config.ts"
        if [[ -f "$kangaroo_config" ]]; then
            print_success "Kangaroo config file exists"
        else
            print_error "Kangaroo config file missing"
            return 1
        fi
    else
        print_error "Kangaroo submodule directory missing"
        return 1
    fi
}

# Function to check network connectivity
check_network_connectivity() {
    print_info "Checking network connectivity..."

    # Check basic internet connectivity
    if ping -c 1 google.com >/dev/null 2>&1; then
        print_success "Internet connectivity is available"
    else
        print_warning "Limited or no internet connectivity"
    fi

    # Check GitHub connectivity
    if curl -s --connect-timeout 5 https://api.github.com >/dev/null; then
        print_success "GitHub API is accessible"
    else
        print_error "Cannot reach GitHub API"
        return 1
    fi

    # Check Holostrap connectivity
    if curl -s --connect-timeout 5 https://holostrap.elohim.host/ >/dev/null; then
        print_success "Holostrap network is accessible"
    else
        print_warning "Cannot reach Holostrap network (may be okay for development)"
    fi
}

# Function to check storage space
check_storage_space() {
    print_info "Checking available storage space..."

    local available_space=$(df -BG . | awk 'NR==2 {print $4}' | sed 's/G//')
    print_info "Available storage: ${available_space}GB"

    if [[ "$available_space" -lt 5 ]]; then
        print_warning "Low storage space (< 5GB)"
    elif [[ "$available_space" -lt 2 ]]; then
        print_error "Very low storage space (< 2GB) - deployment may fail"
        return 1
    else
        print_success "Sufficient storage space available"
    fi
}

# Function to check permissions
check_permissions() {
    print_info "Checking file permissions..."

    # Check write permissions in project directory
    if [[ -w "$PROJECT_ROOT" ]]; then
        print_success "Write permissions in project directory"
    else
        print_error "No write permissions in project directory"
        return 1
    fi

    # Check execution permissions for scripts
    local script_dir="$PROJECT_ROOT/.claude/skills/deployment/scripts"
    if [[ -d "$script_dir" ]]; then
        for script in "$script_dir"/*.sh; do
            if [[ -f "$script" ]]; then
                if [[ -x "$script" ]]; then
                    print_success "Script is executable: $(basename "$script")"
                else
                    print_warning "Script is not executable: $(basename "$script") (run chmod +x)"
                fi
            fi
        done
    fi
}

# Main validation function
run_validation() {
    local errors=0

    echo "Starting comprehensive pre-flight validation..."
    echo ""

    # Run all checks
    check_git_status "$PROJECT_ROOT" "main repository" || ((errors++))
    echo ""

    check_github_cli || ((errors++))
    echo ""

    check_submodules || ((errors++))
    echo ""

    check_environment
    echo ""

    check_build_dependencies || ((errors++))
    echo ""

    check_project_structure || ((errors++))
    echo ""

    check_network_connectivity || ((errors++))
    echo ""

    check_storage_space || ((errors++))
    echo ""

    check_permissions || ((errors++))
    echo ""

    # Summary
    echo "=============================================="
    if [[ "$errors" -eq 0 ]]; then
        print_success "All pre-flight checks passed! ✨"
        echo ""
        print_info "Your environment is ready for deployment."
        return 0
    else
        print_error "$errors pre-flight check(s) failed"
        echo ""
        print_error "Please resolve the issues above before proceeding with deployment."
        return 1
    fi
}

# Help function
show_help() {
    echo "Pre-flight Deployment Validation Script"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  -q, --quiet    Suppress non-error output"
    echo "  -v, --verbose  Show detailed output"
    echo ""
    echo "This script validates your environment and prerequisites"
    echo "before deployment to ensure a smooth release process."
    echo ""
    echo "It checks:"
    echo "  - Git repository status and authentication"
    echo "  - GitHub CLI authentication"
    echo "  - Git submodule status"
    echo "  - Environment variables"
    echo "  - Build dependencies (Node.js, Bun, Nix)"
    echo "  - Project structure"
    echo "  - Network connectivity"
    echo "  - Storage space"
    echo "  - File permissions"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -q|--quiet)
            # Redirect non-error output to /dev/null
            exec 1>/dev/null
            shift
            ;;
        -v|--verbose)
            set -x  # Enable debug output
            shift
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Run validation
run_validation