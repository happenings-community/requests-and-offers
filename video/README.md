# Requests & Offers — Presentation Video

A 90-second animated presentation for the [hAppenings Requests & Offers](https://github.com/happenings-community/requests-and-offers) hApp, built with [Remotion](https://remotion.dev/).

## Purpose

This video serves as a user guide and promotional overview of the Requests & Offers application — a peer-to-peer bulletin board for community coordination built on Holochain. It walks through the core user journey from problem statement to hands-on feature walkthroughs.

## Tech Stack

- **[Remotion](https://remotion.dev/) 4.x** — React-based programmatic video
- **React 18** + **TypeScript 5**
- **1920×1080** @ **30 fps**

## Scripts

```bash
bun start          # Open Remotion Studio (live preview)
bun render         # Render final MP4 to ~/Downloads/requests-offers-video.mp4
bun build          # Alias for render
```

> Requires Node/Bun. Install dependencies with `bun install` or `npm install`.

## Scene Structure

| # | Scene | Frames | Duration | Description |
|---|-------|--------|----------|-------------|
| 1 | TitleScene | 0–90 | 3s | Title card with animated rule and tagline |
| 2 | ProblemScene | 90–390 | 10s | The coordination problem communities face |
| 3 | SolutionScene | 390–630 | 8s | Requests & Offers as the solution |
| 4 | RequestScene | 630–930 | 10s | Creating and browsing requests |
| 5 | BrowseOffersScene | 930–1230 | 10s | Discovering offers in the network |
| 6 | TagDiscoveryScene | 1230–1530 | 10s | Tag-based discovery and filtering |
| 7 | DirectContactScene | 1530–1830 | 10s | Direct contact between members |
| 8 | TechScene | 1830–2430 | 20s | Holochain tech stack and architecture |
| 9 | CTAScene | 2430–2700 | 9s | Call to action and next steps |

## Project Structure

```
video/
├── src/
│   ├── index.ts                  # Remotion entry point
│   ├── Root.tsx                  # Composition definition
│   ├── RequestsOffersVideo.tsx   # Main video with scene sequencing
│   ├── theme.ts                  # PAI_THEME design tokens
│   └── scenes/
│       ├── TitleScene.tsx
│       ├── ProblemScene.tsx
│       ├── SolutionScene.tsx
│       ├── RequestScene.tsx
│       ├── BrowseOffersScene.tsx
│       ├── TagDiscoveryScene.tsx
│       ├── DirectContactScene.tsx
│       ├── TechScene.tsx
│       └── CTAScene.tsx
├── public/                       # Static assets (screenshots, images)
│   └── *.png                     # App screenshots (see list below)
├── remotion.config.ts
├── package.json
└── tsconfig.json
```

## Screenshot Assets

Screenshots of the live application are stored in `public/`. Reference them in scenes using Remotion's `staticFile()` helper:

```tsx
import { Img, staticFile } from 'remotion'

// Inside a scene component:
<Img src={staticFile('admin-dashboard.png')} />
```

### Available Screenshots

**Admin**
| File | Description |
|------|-------------|
| `admin-dashboard.png` | Main admin dashboard overview |
| `admin-management-1.png` | Admin user management (view 1) |
| `admin-management-2.png` | Admin user management (view 2) |

**Service Types**
| File | Description |
|------|-------------|
| `create-service-types.png` | Service type creation form |
| `initialize-service-types.png` | Service type initialization flow |

**Mediums of Exchange (MoE)**
| File | Description |
|------|-------------|
| `moe-creation.png` | Creating a medium of exchange |
| `moe-initialization.png` | MoE initialization step |
| `moe-management.png` | MoE management view |
| `moe-moderation.png` | MoE moderation panel |
| `moe-suggestion-1.png` | MoE suggestion flow (step 1) |
| `moe-suggestion-2.png` | MoE suggestion flow (step 2) |

**Requests**
| File | Description |
|------|-------------|
| `requests-creation.png` | Creating a new request |
| `requests-details.png` | Request detail view |
| `request-creator-details.png` | Request creator profile panel |

**Offers**
| File | Description |
|------|-------------|
| `offer-creation.png` | Creating a new offer |
| `offer-details.png` | Offer detail view |
| `offer-creator-details.png` | Offer creator profile panel |

**My Listings**
| File | Description |
|------|-------------|
| `my-listing.png` | My listings overview |
| `my-listing-archive-1.png` | Archived listings (view 1) |
| `my-listing-archive-2.png` | Archived listings (view 2) |

**Organizations**
| File | Description |
|------|-------------|
| `organization-creation-1.png` | Organization creation (step 1) |
| `organization-creation-2.png` | Organization creation (step 2) |
| `organization-add-member.png` | Adding a member to an organization |
| `organization-add-member-2.png` | Member addition confirmation |
| `organization-contact.png` | Organization contact view |

**Users**
| File | Description |
|------|-------------|
| `user-creation.png` | User profile creation |
| `user-details.png` | User profile detail view |
| `user-management-1.png` | User management panel (view 1) |
| `user-management-2.png` | User management panel (view 2) |
