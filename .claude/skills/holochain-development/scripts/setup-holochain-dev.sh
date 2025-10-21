#!/bin/bash

# Holochain Development Environment Setup Script
# Automatically sets up the complete development environment for Holochain hApp development

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Install Nix package manager
install_nix() {
    log_info "Installing Nix package manager..."

    if command_exists nix; then
        log_success "Nix is already installed"
        return 0
    fi

    # Check system
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        curl --proto '=https' --tlsv1.2 -sSf -L https://install.determinate.systems/nix | sh -s -- install
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        curl --proto '=https' --tlsv1.2 -sSf -L https://install.determinate.systems/nix | sh -s -- install
    else
        log_error "Unsupported operating system: $OSTYPE"
        return 1
    fi

    # Source nix profile
    if [ -e '/nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh' ]; then
        source '/nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh'
    fi

    if command_exists nix; then
        log_success "Nix installed successfully"
    else
        log_error "Nix installation failed"
        return 1
    fi
}

# Install Rust toolchain via Nix
setup_rust() {
    log_info "Setting up Rust toolchain via Nix..."

    # Create shell.nix for the project if it doesn't exist
    if [ ! -f "shell.nix" ]; then
        cat > shell.nix << 'EOF'
{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    rustc
    cargo
    rust-analyzer
    clippy
    rustfmt
    pkg-config
    openssl
    binaryen
    wasm-pack
    nodejs_20
    bun
  ];

  # Environment variables
  RUST_BACKTRACE = "1";
  RUST_LOG = "debug";
}
EOF
        log_success "Created shell.nix"
    fi

    # Enter nix shell to verify setup
    log_info "Verifying Rust toolchain in Nix shell..."
    nix develop --command bash -c "
        if command_exists rustc && command_exists cargo; then
            echo 'Rust toolchain is available'
            rustc --version
            cargo --version
        else
            echo 'Rust toolchain setup failed'
            exit 1
        fi
    "

    log_success "Rust toolchain is ready"
}

# Install Bun package manager
install_bun() {
    log_info "Installing Bun package manager..."

    if command_exists bun; then
        log_success "Bun is already installed"
        return 0
    fi

    curl -fsSL https://bun.sh/install | bash

    # Add bun to PATH
    if [ -d "$HOME/.bun" ]; then
        export PATH="$HOME/.bun/bin:$PATH"
        echo 'export PATH="$HOME/.bun/bin:$PATH"' >> ~/.bashrc
        echo 'export PATH="$HOME/.bun/bin:$PATH"' >> ~/.zshrc
    fi

    if command_exists bun; then
        log_success "Bun installed successfully"
    else
        log_error "Bun installation failed"
        return 1
    fi
}

# Setup project dependencies
setup_project() {
    log_info "Setting up project dependencies..."

    # Create workdir if it doesn't exist
    mkdir -p workdir

    # Download hREA framework DNA
    if [ ! -f "workdir/hrea.dna" ]; then
        log_info "Downloading hREA framework DNA..."
        curl -L --output workdir/hrea.dna https://github.com/h-REA/hREA/releases/download/happ-0.3.2-beta/hrea.dna
        log_success "hREA framework DNA downloaded"
    else
        log_success "hREA framework DNA already exists"
    fi

    # Install Node.js dependencies
    if [ -f "package.json" ]; then
        log_info "Installing Node.js dependencies..."
        bun install
        log_success "Dependencies installed"
    else
        log_warning "No package.json found in current directory"
    fi
}

# Install Holochain development tools
install_holochain_tools() {
    log_info "Installing Holochain development tools..."

    # Install hc (Holochain CLI)
    if ! command_exists hc; then
        log_info "Installing Holochain CLI..."
        cargo install holochain_cli --version "^0.3.0"
        log_success "Holochain CLI installed"
    else
        log_success "Holochain CLI is already installed"
    fi

    # Install hc-spin (development server)
    if ! command_exists hc-spin; then
        log_info "Installing hc-spin..."
        cargo install hc-spin --version "^0.1.0"
        log_success "hc-spin installed"
    else
        log_success "hc-spin is already installed"
    fi

    # Install Tryorama for testing
    if [ -f "package.json" ]; then
        log_info "Installing Tryorama for testing..."
        bun add -D @holochain/tryorama @holochain/client
        log_success "Tryorama installed"
    fi
}

# Setup git hooks
setup_git_hooks() {
    log_info "Setting up git hooks..."

    # Create pre-commit hook for zome compilation
    mkdir -p .git/hooks

    cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
# Pre-commit hook to check zome compilation

echo "Checking zome compilation..."

# Enter nix shell and build zomes
if nix develop --command bash -c "bun run build:zomes"; then
    echo "✅ Zomes compile successfully"
    exit 0
else
    echo "❌ Zome compilation failed"
    echo "Please fix compilation errors before committing"
    exit 1
fi
EOF

    chmod +x .git/hooks/pre-commit
    log_success "Git hooks installed"
}

# Create development scripts
create_dev_scripts() {
    log_info "Creating development scripts..."

    # Create dev setup script
    cat > scripts/dev-setup.sh << 'EOF'
#!/bin/bash
# Quick development environment setup

set -euo pipefail

echo "🚀 Starting development environment..."

# Enter Nix shell
nix develop

echo "✅ Development environment ready!"
echo ""
echo "Available commands:"
echo "  bun start                    - Start development server"
echo "  bun run build:zomes         - Build Rust zomes"
echo "  bun run build:happ          - Build complete hApp"
echo "  bun test                     - Run all tests"
echo "  hc playground               - Open Holochain playground"
EOF

    chmod +x scripts/dev-setup.sh

    # Create new domain script
    cat > scripts/create-domain.sh << 'EOF'
#!/bin/bash
# Create a new domain with all necessary files

set -euo pipefail

if [ $# -eq 0 ]; then
    echo "Usage: ./create-domain.sh <DomainName>"
    echo "Example: ./create-domain.sh MyNewDomain"
    exit 1
fi

DOMAIN_NAME="$1"
DOMAIN_LOWER=$(echo "$1" | tr '[:upper:]' '[:lower:]')

echo "🏗️  Creating domain: $DOMAIN_NAME"

# Create directories
mkdir -p "dnas/requests_and_offers/zomes/integrity/${DOMAIN_LOWER}"
mkdir -p "dnas/requests_and_offers/zomes/coordinator/${DOMAIN_LOWER}"
mkdir -p "ui/src/lib/services/zomes"
mkdir -p "ui/src/lib/stores"
mkdir -p "ui/src/lib/schemas"
mkdir -p "ui/src/lib/errors"
mkdir -p "ui/src/lib/composables"
mkdir -p "tests"

echo "✅ Domain structure created"
echo ""
echo "Next steps:"
echo "1. Implement zomes in: dnas/requests_and_offers/zomes/"
echo "2. Create service in: ui/src/lib/services/zomes/${DOMAIN_LOWER}.service.ts"
echo "3. Create store in: ui/src/lib/stores/${DOMAIN_LOWER}.store.ts"
echo "4. Add tests to: tests/"
EOF

    chmod +x scripts/create-domain.sh

    log_success "Development scripts created"
}

# Verify installation
verify_installation() {
    log_info "Verifying installation..."

    # Check commands
    local commands=("nix" "cargo" "rustc" "bun" "hc" "hc-spin")
    local failed_commands=()

    for cmd in "${commands[@]}"; do
        if command_exists "$cmd"; then
            log_success "✅ $cmd is available"
        else
            log_error "❌ $cmd is not available"
            failed_commands+=("$cmd")
        fi
    done

    # Check files
    local files=("shell.nix" "workdir/hrea.dna")
    for file in "${files[@]}"; do
        if [ -f "$file" ]; then
            log_success "✅ $file exists"
        else
            log_error "❌ $file not found"
        fi
    done

    # Test zome compilation
    if [ -f "dnas/Cargo.toml" ]; then
        log_info "Testing zome compilation..."
        if nix develop --command bash -c "cargo check --target wasm32-unknown-unknown" 2>/dev/null; then
            log_success "✅ Zomes can be compiled"
        else
            log_warning "⚠️  Zome compilation test failed (may be normal if no zomes exist yet)"
        fi
    fi

    # Summary
    if [ ${#failed_commands[@]} -eq 0 ]; then
        log_success "🎉 Installation verification passed!"
        echo ""
        echo "Your Holochain development environment is ready!"
        echo ""
        echo "Next steps:"
        echo "1. Run: nix develop"
        echo "2. Run: bun install"
        echo "3. Run: bun run build:zomes"
        echo "4. Run: bun start"
        echo ""
        echo "Happy coding! 🚀"
    else
        log_error "❌ Installation verification failed"
        echo ""
        echo "Missing commands: ${failed_commands[*]}"
        echo ""
        echo "Please check the installation and try again."
        return 1
    fi
}

# Main setup function
main() {
    echo "🚀 Holochain Development Environment Setup"
    echo "=========================================="
    echo ""

    # Check if we're in the right directory
    if [ ! -f "package.json" ] && [ ! -d "dnas" ]; then
        log_warning "Not in a Holochain project directory"
        echo "Consider running this in a Holochain project directory"
        echo ""
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi

    # Run setup steps
    install_nix
    setup_rust
    install_bun
    setup_project
    install_holochain_tools
    setup_git_hooks
    create_dev_scripts

    echo ""
    echo "🔍 Verifying installation..."
    verify_installation
}

# Run main function if script is executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi