# Requests & Offers - MVP Specification Document

## 1. Introduction

The Requests & Offers - MVP project aims to develop a Holochain application designed to facilitate the exchange of requests and offers within the hAppenings.community. This document outlines the specifications and requirements for the development of this application, focusing on its core functionalities, technologies, and user interactions.

## 2. Objective

The primary objective of this project is to create a simple, open-source Holochain application that enables Creators, Projects, and Developers to reach out to Holochain Advocates with specific requests for support. The application will be built on Holochain, incorporating TimeBanking and Local Exchange Trading System (LETS) design ideas and potentially including a Mutual Credit Currency component in post MVP versions.

## 3. Targeted Audience

This application is specifically tailored for the participants in the Holochain Ecosystem. At hAppenings.community, we have created our own definitions of the individuals who would be participants in Requests & Offers - MVP. The targeted audience includes:

- **Holochain Creators/Projects/Developers**: Individuals or groups actively involved in creating or developing projects within the Holochain ecosystem.
- **Holochain Advocates**: Individuals passionate about the Holochain technology, looking to support projects within the ecosystem.

Additionally, the application is supported by:

- **HoloHosts**: External ecosystem agents who support the community by providing Holo hosting infrastructure for the happ. While not direct users of the application, they play a crucial role in making the application accessible to end-users through the Holo network.

## 4. Core Features

### 4.1 User Management

#### 4.1.1 User Profile

- Creation and authentication of user profiles
- Profile categorization as "advocate" or "creator"
- Multi-device profile access using credentials
- Integration with hREA agents
- Custom Holochain zome for profile management

#### 4.1.2 Profile Links

Users can be linked to:

- Agents
- Organizations
- Requests
- Offers
- Projects
- Skills

#### 4.1.3 User Entry Structure

The `User` entry represents profiles within hAppenings.community, supporting:

- Single user profiles
- Multi-device profile sharing
- Personalized experiences
- Community interactions

##### Links

- **UserUpdates**: User create header → update headers
- **UserAgents**: User → agent (index of associated agents)
- **AllUsers**: Link to `users` anchor (global user index)
- **MyUser**: Current agent → user
- **UserRequests**: User → requests (index)
- **UserOffers**: User → offers (index)
- **UserProjects**: User → projects (index)
- **UserOrganizations**: User → organizations (index)
- **UserSkills**: User → skills (index)

### 4.2 Projects and Organizations

#### 4.2.1 Projects

Projects are organizations `classifiedAs` `Project` in hREA.

##### Project Features

- Creation by organizations or users
- Specific requirements and status tracking
- Team member management
- Category classification

##### Project Links

- **AllProjects**: Link to `projects` anchor
- **ProjectCoordinators**: Project → coordinators
- **ProjectContributors**: Project → contributors
- **ProjectCategories**: Project → categories
- **ProjectRequests**: Project → requests
- **ProjectOffers**: Project → offers

#### 4.2.2 Organizations

Organizations are agents `classifiedAs` `Organization` in hREA.

##### Organization Features

- User-created entities
- Project management capabilities
- Member management
- Category classification

##### Organization Links

- **AllOrganizations**: Link to `organizations` anchor
- **OrganizationCoordinators**: Organization → coordinators
- **OrganizationMembers**: Organization → members
- **OrganizationProjects**: Organization → projects
- **OrganizationCategories**: Organization → categories
- **OrganizationRequests**: Organization → requests
- **OrganizationOffers**: Organization → offers

#### 4.2.3 Coordinator Management

##### Responsibilities

- Project/Organization representation
- Organization/Project profile management
- Member invitation and approval
- Request/Offer management on behalf of the organization/project

##### Coordinator Features

- Network administrator approval required
- Organization/Project profile customization (description, type, skills needed, etc.)
- Request/Offer creation capabilities for the organization/project
- Member invitation and approval management

### 4.3 Requests and Offers

#### 4.3.1 Core Functionality

- hREA integration for economic activities
- Request creation linked to projects/organizations/skills
- Offer creation linked to requests/projects
- Implementation as hREA `intents` and `proposals`

#### 4.3.2 Exchange Completion

- Bilateral confirmation mechanism
- In-app completion verification
- Exchange finalization process

### 4.4 Skills and Categories

#### 4.4.1 Skills

Skills are implemented as Resource Specifications in hREA.

##### Skill Features

- Created through offers
- User profile integration
- Project/Request/Offer association

##### Skill Links

- **AllSkills**: Global skills index
- **SkillUsers**: Skill → users
- **SkillProjects**: Skill → projects
- **SkillRequests**: Skill → requests
- **SkillOffers**: Skill → offers

#### 4.4.2 Categories

Categories are Resource Specifications `classifiedAs` `{category}` in hREA.

##### Category Features

- Administrator-created
- Project organization
- Offer classification
- Organization categorization (derived from projects)

##### Category Links

- **AllCategories**: Global category index
- **CategoryProjects**: Category → projects
- **CategoryOffers**: Category → offers

### 4.5 Search Functionality

#### 4.5.1 Search Capabilities

Each major section includes search functionality:

##### User Search

- Name
- Skills
- Categories
- Location
- Organizations
- Projects

##### Project Search

- Name
- Category
- Organization
- Status
- Skills required

##### Organization Search

- Name
- Category
- Members
- Projects

##### Request/Offer Search

- Type
- Category
- Skills
- Status
- Associated project/organization

### 4.6 Network Administration and Moderation Functionalities

Administrators play a pivotal role in the governance and operation of the network, ensuring its integrity, security, and alignment with the community's objectives. Their responsibilities include:

- **Verification of Users and Organizations**: Administrators are tasked with verifying the authenticity and compliance of users and organizations within the network. This process is crucial for maintaining the integrity of the community and ensuring that all participants are legitimate.
- **Project Creation by Verified Organizations**: Projects within the network can be directly created by verified organizations. This streamlines the project initiation process for organizations that have already been vetted by the network administrators.
- **Verification of Projects Not Managed by Verified Organizations**: In cases where a user wishes to create a project that is not managed by a verified organization, the project must undergo a verification process by the network administrators. This ensures that all projects, regardless of their management structure, meet the network's standards and objectives.
- **Moderator Role**: Administrators can delegate moderator roles to other users. Moderators can perform most administrative tasks except for managing administrators themselves. This includes moderating projects, requests, and offers, ensuring content appropriateness and community guidelines compliance.
- **Suspension**: Administrators have the authority to temporarily or permanently suspend User profiles. This action can be taken in response to violations of community guidelines or other misconduct.
  - **Temporary Suspension**: Administrators have the authority to temporarily suspend user profiles for a specified period.
  - **Indefinitive Suspension**: Administrators have the authority to permanently suspend user profiles.
  - **Unsuspension**: Administrators have the authority to unsuspend suspended user profiles.
  - **Suspension reason**: Administrators can indicate the reason for a user's suspension. The user will be notified of the reason.
  - **Suspension history**: Administrators can view the history of all the suspensions or for a specific user.
- **Flagging System**: Users have the ability to flag organizations, projects, requests, and offers for review by network administrators. This system allows the community to signal potentially inappropriate content or activities, prompting administrative review and action as necessary.
- **Inbox**: Administrators and moderators have access to an inbox that allows them to address user concerns, inquiries, and reports efficiently using the messaging system.

Key aspects of administrator and moderator roles and access include:

- **Exclusive Access to Administration Zome and UI**: Administrators and moderators are granted special access to the `Administration` zome and user interface, enabling them to effectively carry out their duties, including the verification of users, organizations, and projects.
- **Administrators anchor**: The `administrators` anchor is an index of all the administrators of the network. It's what allows the recognition of the administrators.
- **Moderators anchor**: The `moderators` anchor is an index of all the moderators of the network. It's what allows the recognition of the moderators.
- **Progenitor pattern to recognize the first agent**: The first agent in the network is designated as the progenitor. When the progenitorcreate his user profile, the agent becomes the first administrator.

#### 4.6.1 Links

- **AdministratorsUser**: A link from the `administrators` anchor to a user. It is an index of all the administrators of the network.
- **ModeratorsUser**: A link from the `moderators` anchor to a user. It is an index of all the moderators of the network.

#### 4.6.2 User Interface

Administrators have access to the Administration Dashboard, a specialized part of the user interface that includes pages for managing administrators, users, projects, organizations, requests, and offers. This dashboard also incorporates search functionality and special reports, providing administrators with comprehensive tools for network management.

Moderators have access to the same Administration Dashboard, but without the Administrators mangement page.

### 4.7 Roles & Permissions

The Requests & Offers - MVP project is designed with a focus on facilitating collaboration and resource exchange within the hAppenings.community. To ensure a structured and efficient operation, the application defines specific roles and their associated permissions. These roles are crucial for managing the network's operations, ensuring its smooth functioning, and maintaining a healthy and supportive community.

#### 4.7.1 Advocate

- **Onboarded/Approved**: Advocates are individuals passionate about the Holochain technology, looking to support projects within the ecosystem. They are onboarded and approved to participate in the network by the network's administrators.
- **User Profile**: Advocates must file out their user profiles, including essential information and their areas of expertise.
- **Offers**: Advocates can offer their skills, talents, or resources to the network. This includes mentorship, brainstorming sessions, or any other form of support they wish to provide.
- **Reporting**: Advocates have access to reporting features, allowing them to view their exchanges and a general report of total exchanges for the month.

#### 4.7.2 Creator

- **Onboarded/Approved**: Creators are individuals or groups actively involved in creating or developing projects within the Holochain ecosystem. They are onboarded and approved to participate in the network by the network's administrators.
- **User Profile**: Creators can file out their user profiles, including their skills, location, type, etc.
- **Offers**: Creators can make offers, including the skills and talents they wish to offer.
- **Requests**: Creators can make requests for themselves, such as mentoring, brainstorming time, or testing in the early days of their projects.
- **Reporting**: Creators can access reports on their exchanges and a general report of total exchanges for the month.

#### 4.7.3 Projects and Organizations Coordinators

- **Onboarded/Approved**: Projects and organizations coordinators are individuals or groups designated to represent a project or organization within the network. They are onboarded and approved to participate in the network.
- **Project Profile**: Projects and organizations coordinators can file out the project profile, including the skills involved, location, type, etc.
- **Offers**: Projects and organizations coordinators can make offers, including the skills and talents they wish to offer.
- **Requests**: Projects and organizations coordinators can make requests for themselves and on behalf of their projects or organizations, such as fundraising, editing support, or testing of hApp.

#### 4.7.5 Matchmaker (Potential Future Role)

- **Description**: A role that could be added in future versions to facilitate the matching of requests and offers more efficiently.

### 4.8 Communication and Negotiation

To facilitate real-time communication and negotiation among users, the application includes a messaging system. This system enables users to discuss details, negotiate terms, and settle agreements before finalizing exchanges through the acceptance or rejection of offers or requests.

- **User-to-User Messaging**: Allows users to communicate directly with one another, facilitating negotiations and discussions related to requests and offers.
- **Messaging to Administrators**: Provides a channel for users to send messages to network administrators. This feature is accessible through an inbox within the administration panel, allowing administrators to address user concerns, inquiries, and reports efficiently.

This messaging functionality supports the dynamic interaction between users, enhancing the collaborative environment and ensuring smooth transactions within the Requests & Offers - MVP platform.

#### 4.8.1 Suspension Notifications

**Notification System**: Implement a notification system to inform users when they have been suspended and why. This system should also notify the user once the suspension period ends.

## 5. MVP Use Case: Project Collaboration and Skill Matching

### 5.1 User Registration and User profile

- **Use Case**: Users can register and create user profile.
- **Benefit**: Facilitates the creation of a user-centric community, enabling personalized experiences and targeted interactions.

### 5.1.1 User Recovery

- **Use Case**: Users can recover their user profile, including their skills, projects, organizations, requests and offers.
- **Benefit**: Facilitates the creation of a user-centric community, enabling personalized experiences and targeted interactions. It allows the user to link multiple agents/devices to their user profile.

### 5.2 Project Creation

- **Use Case**: Users can create projects, specifying the skills needed and the scope of the project.
- **Benefit**: Allows for the organization and management of projects, ensuring that the right skills are matched with the right projects.

### 5.3 Request Creation

- **Use Case**: Users can create requests for specific skills or resources needed for their projects. These requests can be linked to specific projects, organizations, skills, and team members.
- **Benefit**: Provides a structured way for users to express their needs, ensuring that the right offers are matched with their requests. This functionality supports the efficient allocation of resources and skills within the community.

### 5.4 Offer Creation

- **Use Case**: Users with relevant skills can create offers to contribute to projects, specifying the skills they are offering and how they intend to contribute.
- **Benefit**: Enables direct matching of skills with project needs, facilitating efficient collaboration.

### 5.5 Request and Offer Management

- **Use Case**: Users can manage their requests and offers, including accepting offers from other users.
- **Benefit**: Provides a structured way for users to engage with each other, ensuring that interactions are organized and manageable.

### 5.6 Basic Search Functionality

- **Use Case**: Users can search for requests, offers, projects, organizations, users by name, skills, categories, organizations and projects.
- **Benefit**: Enhances the discoverability of resources within the community, promoting collaboration and innovation.

## 6. Infrastructure

### 6.1 Holo Hosting

- **Holo Hosting Overview**: Leverages HoloHosts for robust and scalable infrastructure, contributing to the network's infrastructure and enhancing performance and reliability.
- **Hosting Requirements**: Requires a distributed network of HoloHosts for high availability and redundancy. The Holo Network can supply multiple HoloHosts for redundancy.
- **Hosting Benefits**: Fosters a decentralized and resilient infrastructure, aligning with Holochain ecosystem principles.

## 7. Technologies

- **Holochain**: Core technology for building the application, ensuring local-first and peer-to-peer network capabilities.
- **SvelteKit**: Utilized for the guest/front-end, providing a modern and efficient framework for web development.
  - **Skeleton UI**: A component library for building user interfaces with SvelteKit and Tailwind.
- **hREA**: hREA (Holochain Resource-Event-Agent) is an implementation of the Valueflows specification. It enables a transparent and trusted account of resource and information flows between decentralized and independent agents, across and within ecosystems.

## 8. User Interface

Color palette :

![hAppening Community color palette](images/happening-community-theme-1.png)

![hAppening Community color palette](images/happening-community-theme-2.png)

## 9. Conclusion

This specification document outlines the key components and functionalities of the Requests & Offers - MVP project. By adhering to these specifications, developers can ensure the successful creation of a Holochain application that effectively facilitates the exchange of requests and offers within the hAppenings.community.
