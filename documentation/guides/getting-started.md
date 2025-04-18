# Getting Started with Requests & Offers

Welcome to the Requests & Offers project! This guide will help you get started with our Holochain-based platform for facilitating exchanges within the hAppenings.community.

## Prerequisites

Before you begin, ensure you have:

- [Holochain Development Environment](https://developer.holochain.org/docs/install/) installed
- Basic understanding of Holochain concepts
- Bun 1.0.0 or later

## Quick Start

1. Clone the repository:

   ```bash
   git clone https://github.com/Happening-Community/requests-and-offers.git
   cd requests-and-offers
   ```

2. Enter the nix shell:

   ```bash
   nix develop
   ```

3. Install dependencies:

   ```bash
   bun install
   ```

4. Start the development environment:

   ```bash
   bun start
   ```

## Project Structure

- **Frontend**: SvelteKit application in `ui/`
- **Backend**: Holochain zomes in `dnas/requests_and_offers/zomes/`
  - Users Organizations: User and organization management
  - Administration: System administration and status management

## Next Steps

1. **Setup & Configuration**
   - Follow our [Installation Guide](./installation.md) for detailed setup
   - Configure your development environment

2. **Understanding the System**
   - Review [Technical Documentation](../technical/README.md)
   - Check [Feature Specifications](../specifications/features.md)
   - Learn about [System Architecture](../technical/README.md#architecture)

3. **Development**
   - Read the [Contributing Guide](./contributing.md)
   - Join our [Developer Community](https://happenings.community/)

## Need Help?

- Join our [Community](https://happenings.community/)
- Check our [Documentation](../README.md)
- Report issues on [GitHub](https://github.com/Happening-Community/requests-and-offers/issues)
- Connect on [Discord](https://discord.gg/happening)
