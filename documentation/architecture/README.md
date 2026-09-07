# Architecture Overview

This document provides a high-level overview of the system architecture — component layout, key design decisions, and where to find deeper documentation for each area.

## System Components

```
requests-and-offers/
├── dnas/requests_and_offers/     # Holochain DNA (Rust)
│   ├── zomes/coordinator/        # Business logic (extern functions)
│   ├── zomes/integrity/          # Entry & link types, validation rules
│   └── utils/                    # Shared utilities (progenitor check, DNA props)
├── ui/                           # SvelteKit 5 frontend
│   └── src/lib/
│       ├── services/             # Effect-TS services — one per domain
│       ├── stores/               # Svelte 5 Rune-based stores
│       ├── composables/          # Business logic bridging stores and components
│       ├── schemas/              # Effect Schema validation
│       └── errors/               # Tagged error definitions
└── tests/sweettest/              # Rust integration tests (Holochain Sweettest)
```

## 7-Layer Frontend Architecture

The frontend follows a strict layered pattern. Each domain (Service Types, Requests, Offers, Users, Organizations, Administration, Exchanges, Mediums of Exchange) implements all seven layers:

1. **Service** — Effect-native service with `Context.Tag` dependency injection
2. **Store** — Svelte 5 Runes with Effect integration
3. **Schema** — `Schema.Class` validation at business boundaries
4. **Errors** — `Data.TaggedError` domain-specific errors
5. **Composables** — component logic abstraction
6. **Components** — Svelte 5 with accessibility focus
7. **Testing** — Vitest unit tests per layer

For detailed patterns see [Architectural Patterns](../guides/architectural-patterns.md) and [Effect-TS Primer](../guides/effect-ts-primer.md).

## Network Bootstrap: The Progenitor Pattern

Holochain has no central authority to assign the first administrator. The **progenitor pattern** solves this by embedding the founding agent's public key directly in the DNA properties at network creation time.

When the progenitor calls `create_user`, the `users_organizations` coordinator detects the match and automatically registers them as the first administrator via a cross-zome call to `administration::add_administrator`. No explicit admin registration step is required.

**Two deployment modes:**

| Mode | `progenitor_pubkey` in `workdir/happ.yaml` | First admin |
|------|---------------------------------------------|-------------|
| Production | Set to the creator's actual agent pubkey | Only the progenitor |
| Dev / local | `~` (null) | First agent to call `create_user` |

The progenitor is a regular, revocable administrator — no permanent elevated privilege. The integrity zome delegates all authorization to the coordinator layer (HDI 0.7.0 does not support `get_links` inside validation callbacks).

For a full explanation including configuration, API reference, and test patterns, see [The Progenitor Pattern](../progenitor.md).

## hREA Integration

The project integrates the hREA (Holochain Resource-Event-Agent) framework for Valueflows-based economic coordination. For details see [hREA Integration](hrea-integration.md).

## Further Reading

- [Architectural Patterns Guide](../guides/architectural-patterns.md) — 7-layer deep-dive
- [The Progenitor Pattern](../progenitor.md) — network bootstrap mechanism
- [Administration Zome Spec](../technical-specs/zomes/administration.md) — admin/progenitor API
- [hREA Integration](hrea-integration.md) — Valueflows economic layer
- [Membrane Management](MEMBRANE_MANAGEMENT.md) — in-DHT membrane enforcement
- [Membrane Management (Off-DHT)](MEMBRANE_MANAGEMENT_OFF_DHT.md) — off-DHT companion
- [Notification Architecture](NOTIFICATION_ARCHITECTURE.md) — durable notification primitive; interest markers as first consumer, flagging second
