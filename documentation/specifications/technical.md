# Technical Specifications

## 1. Infrastructure

### 1.1 Holo Hosting

- **Holo Hosting Overview**: Leverages HoloHosts for robust and scalable infrastructure, contributing to the network's infrastructure and enhancing performance and reliability.
- **Hosting Requirements**: Requires a distributed network of HoloHosts for high availability and redundancy. The Holo Network can supply multiple HoloHosts for redundancy.
- **Hosting Benefits**: Fosters a decentralized and resilient infrastructure, aligning with Holochain ecosystem principles.

## 2. Technologies

### 2.1 Core Technologies

- **Holochain**: Core technology for building the application, ensuring local-first and peer-to-peer network capabilities.
- **SvelteKit**: Utilized for the guest/front-end, providing a modern and efficient framework for web development.
  - **Skeleton UI**: A component library for building user interfaces with SvelteKit and Tailwind.
- **hREA**: hREA (Holochain Resource-Event-Agent) is an implementation of the Valueflows specification. It enables a transparent and trusted account of resource and information flows between decentralized and independent agents, across and within ecosystems.
  - For detailed hREA integration specifications, see [hREA Integration](../technical/architecture/hrea-integration.md)

### 2.2 Communication Systems

#### Messaging System

- User-to-User Messaging
- Administrator Communication Channel
- Notification System for Suspensions

#### Real-time Features

- Direct messaging capabilities
- Negotiation support
- Agreement finalization
- Status updates
- Exchange notifications

### 2.3 Security Features

- User Authentication
- Profile Recovery System
- Administrator Access Controls
- Suspension Management

### 2.4 Data Management

#### Link Types

- **User Links**: Profile updates, agent associations, requests/offers
- **Project Links**: Coordinators, contributors, categories
- **Organization Links**: Members, projects, categories
- **Skill Links**: Users, projects, requests/offers
- **Category Links**: Projects, offers, organizations

#### Anchor System

- **Administrators Anchor**: Index of network administrators
- **Moderators Anchor**: Index of network moderators
- **Users Anchor**: Global user index
- **Projects Anchor**: Global project index
- **Organizations Anchor**: Global organization index

## 3. User Interface

### 3.1 Design System

Color palette:

![hAppening Community color palette](../assets/images/happening-community-theme-1.png)

![hAppening Community color palette](../assets/images/happening-community-theme-2.png)

### 3.2 Key Interfaces

- User Dashboard
- Project Management Interface
- Request/Offer Management
- Administration Dashboard
- Search Interface
- Messaging Interface

### 3.3 Administrative Interface

- User Management
- Project Verification
- Organization Management
- Request/Offer Moderation
- Reporting Tools

## 4. System Architecture

The system architecture is documented using the C4 model, which provides different levels of abstraction to understand the system structure.

### 4.1 System Context

The following diagram shows the high-level system context and key user roles:

```mermaid
C4Context
    title System Context diagram for Requests and Offers System

    Person(advocate, "Advocate", "Individual supporting Holochain projects")
    Person(creator, "Creator", "Individual or group developing projects")
    Person(admin, "Administrator", "System administrator")

    System(requestsAndOffers, "Requests and Offers hApp", "A decentralized application for creating, managing, and responding to requests and offers")

    System_Ext(holoHost, "Holo Host", "Decentralized hosting infrastructure")
    System_Ext(hrea, "hREA", "Resource-Event-Agent implementation")

    Rel(advocate, requestsAndOffers, "Creates offers, responds to requests")
    Rel(creator, requestsAndOffers, "Creates requests, manages projects")
    Rel(admin, requestsAndOffers, "Manages users and system")

    Rel(requestsAndOffers, holoHost, "Hosted on")
    Rel(requestsAndOffers, hrea, "Uses for resource management")
```

### 4.2 Container Structure

The container diagram shows the high-level technical building blocks:

```mermaid
C4Container
    title Container diagram for Requests and Offers System

    Person(advocate, "Advocate", "Individual supporting Holochain projects")
    Person(creator, "Creator", "Individual or group developing projects")
    Person(admin, "Administrator", "System administrator")

    System_Boundary(c1, "Requests and Offers hApp") {
        Container(frontend, "Frontend UI", "SvelteKit + Skeleton UI", "Provides user interface for interacting with the system")
        Container(backend, "DNA", "Rust Holochain Zome", "Core business logic and data validation")
        Container(storage, "DHT", "Holochain Distributed Hash Table", "Decentralized data storage")
        Container(messaging, "Messaging System", "Rust Holochain Zome", "Handles user-to-user communication")
    }

    System_Ext(holoHost, "Holo Host", "Decentralized hosting infrastructure")
    System_Ext(hrea, "hREA", "Resource-Event-Agent implementation")

    Rel(advocate, frontend, "Interacts with")
    Rel(creator, frontend, "Interacts with")
    Rel(admin, frontend, "Manages through")

    Rel(frontend, backend, "Calls zome functions")
    Rel(frontend, messaging, "Sends/receives messages")

    Rel(backend, storage, "Stores and retrieves data")
    Rel(backend, hrea, "Manages resources and events")
    Rel(messaging, storage, "Stores messages")

    Rel(backend, holoHost, "Hosted on")
    Rel(messaging, holoHost, "Hosted on")
```

### 4.3 Component Structure

The component diagram details the internal structure of each container:

```mermaid
C4Component
    title Component diagram for Requests and Offers System

    Container_Boundary(frontend, "Frontend") {
        Component(ui, "UI Components", "Skeleton UI", "User interface elements")
        Component(auth, "Auth Manager", "SvelteKit", "Handles authentication")
        Component(state, "State Manager", "SvelteKit Store", "Manages application state")
    }

    Container_Boundary(backend, "Backend DNA") {
        Component(userMgmt, "User Management", "Holochain Zome", "Handles user profiles and roles")
        Component(projectMgmt, "Project Management", "Holochain Zome", "Manages projects and teams")
        Component(requestOffer, "Request/Offer System", "Holochain Zome", "Handles requests and offers")
        Component(admin, "Admin Tools", "Holochain Zome", "System administration features")
        Component(search, "Search Engine", "Holochain Zome", "Search and discovery")
    }

    Container_Boundary(messaging, "Messaging DNA") {
        Component(direct, "Direct Messaging", "Holochain Zome", "User-to-user messaging")
        Component(notifications, "Notifications", "Holochain Zome", "System notifications")
    }

    Rel(ui, auth, "Uses")
    Rel(ui, state, "Updates/reads")

    Rel(auth, userMgmt, "Authenticates")
    Rel(state, userMgmt, "Syncs user data")
    Rel(state, projectMgmt, "Syncs project data")
    Rel(state, requestOffer, "Syncs requests/offers")
    Rel(state, direct, "Syncs messages")
    Rel(state, notifications, "Syncs notifications")

    Rel(userMgmt, projectMgmt, "Associates users")
    Rel(projectMgmt, requestOffer, "Links projects")
    Rel(admin, userMgmt, "Manages users")
    Rel(search, requestOffer, "Indexes")
    Rel(search, projectMgmt, "Indexes")
```

### 4.4 Code Structure

The code structure diagram shows the organization of the codebase:

```mermaid
C4Component
    title Requests and Offers Code Structure Diagram
    
    Container_Boundary(ui, "UI (Svelte)") {
        Component(routes, "+page.svelte", "Route components")
        Component(components, "Components", "Reusable UI components")
        Component(stores, "Stores", "State management")
        Component(services, "Services", "API communication")
    }
    
    Container_Boundary(dna, "DNA (Rust)") {
        Component(entries, "Entries", "Data structures")
        Component(zomes, "Zomes", "Business logic")
        Component(links, "Links", "Relationships")
        Component(validation, "Validation", "Data validation rules")
    }
    
    Rel(routes, components, "Uses")
    Rel(routes, stores, "Uses")
    Rel(components, stores, "Uses")
    Rel(services, stores, "Updates")
    
    Rel(services, zomes, "Calls")
    Rel(zomes, entries, "Creates/Updates")
    Rel(zomes, links, "Manages")
    Rel(entries, validation, "Validates against")
```

### 4.5 Architecture Principles

1. **Decentralization**: The system leverages Holochain's peer-to-peer architecture to ensure:
   - Data sovereignty
   - Resilient infrastructure
   - No single point of failure

2. **Modularity**: The system is built with clear separation of concerns:
   - Frontend (SvelteKit + Skeleton UI)
   - Backend DNA (Holochain Zomes)
   - Messaging DNA
   - Data storage (DHT)

3. **Security**: Built-in security features:
   - User authentication
   - Role-based access control
   - Data validation
   - Secure messaging

4. **Scalability**: The system is designed to scale through:
   - Distributed hosting
   - Efficient data structures
   - Modular components
