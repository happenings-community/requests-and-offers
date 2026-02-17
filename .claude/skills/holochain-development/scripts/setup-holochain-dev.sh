#!/bin/bash

# Holochain Development Environment Setup
# This project uses Nix flakes (flake.nix), not shell.nix

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info()    { echo -e "[INFO] $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1"; }

command_exists() { command -v "$1" >/dev/null 2>&1; }

# --- Check prerequisites ---

check_nix() {
  if command_exists nix; then
    log_success "Nix installed: $(nix --version)"
    # Check flakes support
    if nix eval --expr 'true' 2>/dev/null; then
      log_success "Nix flakes enabled"
    else
      log_warn "Nix flakes may not be enabled. Add 'experimental-features = nix-command flakes' to ~/.config/nix/nix.conf"
    fi
  else
    log_error "Nix not installed. Install from: https://install.determinate.systems/nix"
    log_info "Run: curl --proto '=https' --tlsv1.2 -sSf -L https://install.determinate.systems/nix | sh -s -- install"
    exit 1
  fi
}

check_bun() {
  if command_exists bun; then
    log_success "Bun installed: $(bun --version)"
  else
    log_error "Bun not installed. Install from: https://bun.sh"
    exit 1
  fi
}

check_rust() {
  if command_exists rustc; then
    log_success "Rust installed: $(rustc --version)"
    if rustup target list --installed | grep -q wasm32-unknown-unknown; then
      log_success "wasm32 target available"
    else
      log_warn "wasm32 target missing. Run: rustup target add wasm32-unknown-unknown"
    fi
  else
    log_warn "Rust not found in PATH (expected — Nix provides it via flake.nix)"
  fi
}

# --- Validate project structure ---

check_project() {
  if [ ! -f "flake.nix" ]; then
    log_error "flake.nix not found. Are you in the project root?"
    exit 1
  fi
  log_success "flake.nix found"

  if [ -d "dnas" ]; then
    log_success "dnas/ directory found"
  else
    log_error "dnas/ directory not found"
    exit 1
  fi

  if [ -d "ui" ]; then
    log_success "ui/ directory found"
  else
    log_error "ui/ directory not found"
    exit 1
  fi
}

# --- Install dependencies ---

install_deps() {
  log_info "Installing UI dependencies..."
  cd ui && bun install && cd ..
  log_success "UI dependencies installed"
}

# --- Check hREA DNA ---

check_hrea() {
  if [ -f "workdir/hrea.dna" ]; then
    log_success "hREA DNA found at workdir/hrea.dna"
  else
    log_warn "hREA DNA not found. It will be downloaded on first 'bun install'"
  fi
}

# --- Main ---

main() {
  echo "=== Holochain Dev Environment Check ==="
  echo ""

  check_project
  check_nix
  check_bun
  check_rust
  check_hrea

  echo ""
  echo "=== Quick Start ==="
  echo "  nix develop                    # Enter dev shell (Holochain 0.6)"
  echo "  bun build:zomes               # Build Rust zomes"
  echo "  bun build:happ                # Build complete hApp"
  echo "  bun start                     # Start dev server (2 agents)"
  echo "  bun test                      # Run all tests"
  echo "  nix develop --command bun test:unit  # Unit tests in Nix"
  echo ""
  log_success "Environment check complete"
}

main "$@"
