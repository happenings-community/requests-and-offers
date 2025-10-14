#!/bin/bash

# deploy.sh - Main deployment orchestrator for Requests and Offers
# Coordinates full deployment across all repositories with validation and rollback

set -euo pipefail

# Script directory and library loading
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LIB_DIR="$SCRIPT_DIR/lib"

# Source all utility libraries
source "$LIB_DIR/validation.sh"
source "$LIB_DIR/version-manager.sh"
source "$LIB_DIR/webapp-builder.sh"
source "$LIB_DIR/kangaroo-deployer.sh"
source "$LIB_DIR/homebrew-updater.sh"

# Default configuration
DEFAULT_TIMEOUT=15
DEFAULT_COMPONENTS="all"

# Global variables
DEPLOYMENT_START_TIME=""
DEPLOYMENT_LOG_FILE=""
ROLLBACK_AVAILABLE="false"

# Initialize deployment logging
init_deployment() {
    local version="$1"
    
    DEPLOYMENT_START_TIME=$(date +%s)
    DEPLOYMENT_LOG_FILE="/tmp/deployment-${version}-$(date +%Y%m%d-%H%M%S).log"
    
    log_info "Starting deployment for version $version"
    log_info "Deployment log: $DEPLOYMENT_LOG_FILE"
    
    # Redirect all output to log file as well
    exec 1> >(tee -a "$DEPLOYMENT_LOG_FILE")
    exec 2> >(tee -a "$DEPLOYMENT_LOG_FILE" >&2)
    
    log_json "info" "Deployment initialized" "{\"version\":\"$version\",\"log_file\":\"$DEPLOYMENT_LOG_FILE\"}"
}

# Print deployment summary
print_summary() {
    local version="$1"
    local status="$2"
    local duration="$3"
    
    echo ""
    echo "==============================================="
    echo "         DEPLOYMENT SUMMARY"
    echo "==============================================="
    echo "Version: $version"
    echo "Status: $status"
    echo "Duration: ${duration}s"
    echo "Started: $(date -d @"$DEPLOYMENT_START_TIME" '+%Y-%m-%d %H:%M:%S')"
    echo "Finished: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "Log file: $DEPLOYMENT_LOG_FILE"
    echo ""
    
    if [[ "$status" == "SUCCESS" ]]; then
        echo "🎉 Deployment completed successfully!"
        echo ""
        echo "Next steps:"
        echo "1. Verify all download links work correctly"
        echo "2. Test installation on each platform"
        echo "3. Update documentation if needed"
        echo ""
        echo "Download URLs:"
        echo "- Main release: https://github.com/happenings-community/requests-and-offers/releases/tag/v$version"
        echo "- Desktop apps: https://github.com/happenings-community/requests-and-offers-kangaroo-electron/releases/tag/v$version"
        echo "- Homebrew: brew install happenings-community/requests-and-offers/requests-and-offers"
    else
        echo "❌ Deployment failed!"
        echo ""
        if [[ "$ROLLBACK_AVAILABLE" == "true" ]]; then
            echo "Rollback available. Run:"
            echo "$0 rollback $version"
        else
            echo "Manual cleanup may be required."
        fi
        echo ""
        echo "Check the log file for detailed error information."
    fi
    
    echo "==============================================="
}

# Show usage information
show_usage() {
    cat << EOF
Usage: $0 <command> [options...]

COMMANDS:
  deploy <version>              - Full deployment process
  rollback <version>           - Rollback deployment
  status                       - Check deployment status
  validate <version>           - Validate deployment
  clean                        - Clean up old deployments

DEPLOY OPTIONS:
  --components <list>          - Deploy specific components (default: all)
                                 Options: webapp,kangaroo,homebrew
  --timeout <minutes>          - Build timeout in minutes (default: 15)
  --skip-tests                 - Skip test execution
  --skip-homebrew-test         - Skip Homebrew installation test
  --dry-run                    - Show what would be done without executing
  --yes                        - Auto-confirm all prompts
  --json                       - Enable JSON output mode

EXAMPLES:
  # Full deployment
  $0 deploy 0.1.0-alpha.7

  # Dry run to see what would happen
  $0 deploy 0.1.0-alpha.7 --dry-run

  # Deploy only webapp and kangaroo
  $0 deploy 0.1.0-alpha.7 --components webapp,kangaroo

  # Deploy with longer timeout and skip tests
  $0 deploy 0.1.0-alpha.7 --timeout 30 --skip-tests --yes

  # Check status
  $0 status

  # Validate completed deployment
  $0 validate 0.1.0-alpha.7

  # Rollback if something went wrong
  $0 rollback 0.1.0-alpha.7

COMPONENT DESCRIPTIONS:
  webapp     - Build and release main Holochain application
  kangaroo   - Build and release desktop applications for all platforms
  homebrew   - Update Homebrew formula with new version and checksums

ENVIRONMENT VARIABLES:
  JSON_OUTPUT=true             - Enable JSON output mode globally
  DEPLOYMENT_CONFIG            - Custom config file path
EOF
}

# Parse command line arguments
parse_arguments() {
    local cmd="$1"
    shift
    
    # Initialize variables with defaults
    VERSION=""
    COMPONENTS="$DEFAULT_COMPONENTS"
    TIMEOUT="$DEFAULT_TIMEOUT"
    SKIP_TESTS="false"
    SKIP_HOMEBREW_TEST="false"
    DRY_RUN="false"
    AUTO_YES="false"
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --components)
                COMPONENTS="$2"
                shift 2
                ;;
            --timeout)
                TIMEOUT="$2"
                shift 2
                ;;
            --skip-tests)
                SKIP_TESTS="true"
                shift
                ;;
            --skip-homebrew-test)
                SKIP_HOMEBREW_TEST="true"
                shift
                ;;
            --dry-run)
                DRY_RUN="true"
                shift
                ;;
            --yes)
                AUTO_YES="true"
                shift
                ;;
            --json)
                export JSON_OUTPUT="true"
                shift
                ;;
            --help|-h)
                show_usage
                exit 0
                ;;
            -*)
                log_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
            *)
                if [[ -z "$VERSION" ]]; then
                    VERSION="$1"
                else
                    log_error "Unexpected argument: $1"
                    exit 1
                fi
                shift
                ;;
        esac
    done
    
    # Validate required arguments
    if [[ "$cmd" == "deploy" || "$cmd" == "validate" || "$cmd" == "rollback" ]] && [[ -z "$VERSION" ]]; then
        log_error "Version is required for $cmd command"
        show_usage
        exit 1
    fi
    
    # Export parsed variables
    export VERSION COMPONENTS TIMEOUT SKIP_TESTS SKIP_HOMEBREW_TEST DRY_RUN AUTO_YES
}

# Confirm deployment with user
confirm_deployment() {
    local version="$1"
    
    if [[ "$AUTO_YES" == "true" || "$DRY_RUN" == "true" ]]; then
        return 0
    fi
    
    echo ""
    echo "==============================================="
    echo "         DEPLOYMENT CONFIRMATION"
    echo "==============================================="
    echo "Version: $version"
    echo "Components: $COMPONENTS"
    echo "Timeout: ${TIMEOUT} minutes"
    echo "Skip tests: $SKIP_TESTS"
    echo "Skip Homebrew test: $SKIP_HOMEBREW_TEST"
    echo ""
    echo "This will:"
    echo "1. Build and release the webapp"
    echo "2. Trigger cross-platform desktop builds"
    echo "3. Update Homebrew formula"
    echo "4. Create GitHub releases in multiple repositories"
    echo ""
    
    read -p "Do you want to continue? (y/N): " -n 1 -r
    echo
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Deployment cancelled by user"
        exit 0
    fi
}

# Check if component should be deployed
should_deploy_component() {
    local component="$1"
    
    if [[ "$COMPONENTS" == "all" ]]; then
        return 0
    fi
    
    if [[ ",$COMPONENTS," == *",$component,"* ]]; then
        return 0
    fi
    
    return 1
}

# Pre-deployment validation
pre_deployment_validation() {
    local version="$1"
    
    log_info "Running pre-deployment validation..."
    
    # Load configuration and validate environment
    load_config
    
    if ! validate_environment; then
        log_error "Environment validation failed"
        return 1
    fi
    
    # Validate version format
    if ! validate_version "$version"; then
        log_error "Version validation failed"
        return 1
    fi
    
    # Check if version already exists in repositories
    local main_owner main_repo kangaroo_owner kangaroo_repo
    main_owner=$(get_config '.repositories.main.owner')
    main_repo=$(get_config '.repositories.main.repo')
    kangaroo_owner=$(get_config '.repositories.kangaroo.owner')
    kangaroo_repo=$(get_config '.repositories.kangaroo.repo')
    
    if should_deploy_component "webapp" && check_version_exists "$version" "$main_owner" "$main_repo"; then
        log_warning "Version $version already exists in main repository"
        if [[ "$AUTO_YES" != "true" ]]; then
            read -p "Continue anyway? (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                return 1
            fi
        fi
    fi
    
    if should_deploy_component "kangaroo" && check_version_exists "$version" "$kangaroo_owner" "$kangaroo_repo"; then
        log_warning "Version $version already exists in Kangaroo repository"
        if [[ "$AUTO_YES" != "true" ]]; then
            read -p "Continue anyway? (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                return 1
            fi
        fi
    fi
    
    log_success "Pre-deployment validation passed"
    return 0
}

# Deploy webapp component
deploy_webapp() {
    local version="$1"
    
    if ! should_deploy_component "webapp"; then
        log_info "Skipping webapp deployment (not in components list)"
        return 0
    fi
    
    log_info "=== DEPLOYING WEBAPP ==="
    
    # Full webapp build and release
    if ! "$LIB_DIR/webapp-builder.sh" full "$version" "$SKIP_TESTS" "true" "false" "$DRY_RUN"; then
        log_error "WebApp deployment failed"
        return 1
    fi
    
    log_success "WebApp deployment completed"
    return 0
}

# Deploy Kangaroo component
deploy_kangaroo() {
    local version="$1"
    
    if ! should_deploy_component "kangaroo"; then
        log_info "Skipping Kangaroo deployment (not in components list)"
        return 0
    fi
    
    log_info "=== DEPLOYING KANGAROO ==="
    
    # Full Kangaroo deployment
    if ! "$LIB_DIR/kangaroo-deployer.sh" deploy "$version" "$TIMEOUT" "$DRY_RUN"; then
        log_error "Kangaroo deployment failed"
        return 1
    fi
    
    log_success "Kangaroo deployment completed"
    return 0
}

# Deploy Homebrew component
deploy_homebrew() {
    local version="$1"
    
    if ! should_deploy_component "homebrew"; then
        log_info "Skipping Homebrew deployment (not in components list)"
        return 0
    fi
    
    log_info "=== DEPLOYING HOMEBREW ==="
    
    # Update Homebrew formula
    local test_install="false"
    if [[ "$SKIP_HOMEBREW_TEST" != "true" ]]; then
        test_install="true"
    fi
    
    if ! "$LIB_DIR/homebrew-updater.sh" update "$version" "$test_install" "$DRY_RUN"; then
        log_error "Homebrew deployment failed"
        return 1
    fi
    
    log_success "Homebrew deployment completed"
    return 0
}

# Post-deployment validation
post_deployment_validation() {
    local version="$1"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log_info "[DRY RUN] Would run post-deployment validation"
        return 0
    fi
    
    log_info "=== POST-DEPLOYMENT VALIDATION ==="
    
    # Validate main repository release if deployed
    if should_deploy_component "webapp"; then
        local main_owner main_repo
        main_owner=$(get_config '.repositories.main.owner')
        main_repo=$(get_config '.repositories.main.repo')
        
        if ! test_download_links "$version" "$main_owner" "$main_repo"; then
            log_error "Main repository download validation failed"
            return 1
        fi
    fi
    
    # Validate Kangaroo repository assets if deployed
    if should_deploy_component "kangaroo"; then
        local kangaroo_owner kangaroo_repo
        kangaroo_owner=$(get_config '.repositories.kangaroo.owner')
        kangaroo_repo=$(get_config '.repositories.kangaroo.repo')
        
        if ! validate_release_assets "$version" "$kangaroo_owner" "$kangaroo_repo"; then
            log_error "Kangaroo assets validation failed"
            return 1
        fi
        
        if ! test_download_links "$version" "$kangaroo_owner" "$kangaroo_repo"; then
            log_error "Kangaroo download validation failed"
            return 1
        fi
    fi
    
    log_success "Post-deployment validation passed"
    return 0
}

# Full deployment process
run_deployment() {
    local version="$1"
    
    # Initialize deployment
    init_deployment "$version"
    
    # Create backup
    if [[ "$DRY_RUN" != "true" ]]; then
        "$LIB_DIR/validation.sh" backup "$version"
        ROLLBACK_AVAILABLE="true"
    fi
    
    # Pre-deployment validation
    if ! pre_deployment_validation "$version"; then
        log_error "Pre-deployment validation failed"
        return 1
    fi
    
    # Sync versions across repositories
    if [[ "$DRY_RUN" != "true" ]]; then
        log_info "=== SYNCING VERSIONS ==="
        if ! "$LIB_DIR/version-manager.sh" sync "$version" "$DRY_RUN"; then
            log_error "Version synchronization failed"
            return 1
        fi
    fi
    
    # Deploy components
    if ! deploy_webapp "$version"; then
        return 1
    fi
    
    if ! deploy_kangaroo "$version"; then
        return 1
    fi
    
    if ! deploy_homebrew "$version"; then
        return 1
    fi
    
    # Post-deployment validation
    if ! post_deployment_validation "$version"; then
        log_error "Post-deployment validation failed"
        return 1
    fi
    
    # Create git tags
    if [[ "$DRY_RUN" != "true" ]]; then
        log_info "=== CREATING GIT TAGS ==="
        if ! "$LIB_DIR/version-manager.sh" tag "$version" "$DRY_RUN"; then
            log_warning "Git tag creation failed (non-critical)"
        fi
    fi
    
    log_success "Full deployment completed successfully"
    return 0
}

# Rollback deployment
rollback_deployment() {
    local version="$1"
    
    log_info "Rolling back deployment for version $version"
    
    load_config
    
    # Restore from backup
    if ! "$LIB_DIR/validation.sh" restore; then
        log_error "Backup restoration failed"
        return 1
    fi
    
    log_success "Rollback completed"
    return 0
}

# Check deployment status
check_deployment_status() {
    load_config
    
    echo "Deployment Status Check"
    echo "======================"
    
    # Check latest versions in each repository
    local main_version kangaroo_version
    main_version=$("$LIB_DIR/version-manager.sh" get)
    
    local kangaroo_path
    kangaroo_path=$(get_config '.repositories.kangaroo.path')
    kangaroo_version=$(jq -r '.version' "$kangaroo_path/package.json")
    
    echo "Main repository version: $main_version"
    echo "Kangaroo repository version: $kangaroo_version"
    
    # Check version consistency
    if "$LIB_DIR/version-manager.sh" validate; then
        echo "✅ Version consistency: PASS"
    else
        echo "❌ Version consistency: FAIL"
    fi
    
    # Check latest build status
    echo ""
    echo "Latest Kangaroo Build Status:"
    "$LIB_DIR/kangaroo-deployer.sh" status
}

# Validate existing deployment
validate_deployment() {
    local version="$1"
    
    log_info "Validating deployment for version $version"
    
    load_config
    
    # Check main repository
    local main_owner main_repo
    main_owner=$(get_config '.repositories.main.owner')
    main_repo=$(get_config '.repositories.main.repo')
    
    if ! gh release view "v$version" --repo "$main_owner/$main_repo" &> /dev/null; then
        log_error "Main repository release not found"
        return 1
    fi
    
    # Check Kangaroo repository
    local kangaroo_owner kangaroo_repo
    kangaroo_owner=$(get_config '.repositories.kangaroo.owner')
    kangaroo_repo=$(get_config '.repositories.kangaroo.repo')
    
    if ! gh release view "v$version" --repo "$kangaroo_owner/$kangaroo_repo" &> /dev/null; then
        log_error "Kangaroo repository release not found"
        return 1
    fi
    
    # Validate assets
    if ! "$LIB_DIR/validation.sh" assets "$version" "$kangaroo_owner" "$kangaroo_repo"; then
        return 1
    fi
    
    # Test download links
    if ! "$LIB_DIR/validation.sh" downloads "$version" "$kangaroo_owner" "$kangaroo_repo"; then
        return 1
    fi
    
    log_success "Deployment validation passed"
    return 0
}

# Clean up old deployments
clean_deployments() {
    log_info "Cleaning up old deployments"
    
    # Clean up backups
    "$LIB_DIR/validation.sh" cleanup 5
    
    # Clean up log files older than 30 days
    find /tmp -name "deployment-*.log" -mtime +30 -delete 2>/dev/null || true
    
    log_success "Cleanup completed"
}

# Main function
main() {
    local command="${1:-help}"
    
    case "$command" in
        "deploy")
            shift
            parse_arguments "deploy" "$@"
            
            if [[ -z "$VERSION" ]]; then
                log_error "Version is required for deploy command"
                show_usage
                exit 1
            fi
            
            confirm_deployment "$VERSION"
            
            local start_time end_time duration
            start_time=$(date +%s)
            
            if run_deployment "$VERSION"; then
                end_time=$(date +%s)
                duration=$((end_time - start_time))
                print_summary "$VERSION" "SUCCESS" "$duration"
                exit 0
            else
                end_time=$(date +%s)
                duration=$((end_time - start_time))
                print_summary "$VERSION" "FAILED" "$duration"
                exit 1
            fi
            ;;
        "rollback")
            shift
            parse_arguments "rollback" "$@"
            rollback_deployment "$VERSION"
            ;;
        "status")
            check_deployment_status
            ;;
        "validate")
            shift
            parse_arguments "validate" "$@"
            validate_deployment "$VERSION"
            ;;
        "clean")
            clean_deployments
            ;;
        "help"|"-h"|"--help"|*)
            show_usage
            ;;
    esac
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi