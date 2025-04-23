# Detailed Feature Specifications

## 1. User Management

### 1.1 User Profile

- Creation and authentication of user profiles
- Profile categorization as "advocate" or "creator"
- Multi-device profile access using credentials
- Integration with hREA agents
- Custom Holochain zome for profile management

### 1.2 Profile Links

Users can be linked to:

- Agents
- Organizations
- Requests
- Offers
- Projects
- Skills

### 1.3 User Entry Structure

The `User` entry represents profiles within hAppenings.community, supporting:

- Single user profiles
- Multi-device profile sharing
- Personalized experiences
- Community interactions

#### Links

- **UserUpdates**: User create header → update headers
- **UserAgents**: User → agent (index of associated agents)
- **AllUsers**: Link to `users` anchor (global user index)
- **MyUser**: Current agent → user
- **UserRequests**: User → requests (index)
- **UserOffers**: User → offers (index)
- **UserProjects**: User → projects (index)
- **UserOrganizations**: User → organizations (index)
- **UserSkills**: User → skills (index)

## 2. Projects and Organizations

### 2.1 Projects

Projects are organizations `classifiedAs` `Project` in hREA.

#### Project Features

- Creation by organizations or users
- Specific requirements and status tracking
- Team member management
- Category classification

#### Project Status Flow

![Project Status Flow](../assets/images/project-status.png)

#### Project Types

![Types of Projects](../assets/images/types-of-projects.png)

#### Project Links

- **AllProjects**: Link to `projects` anchor
- **ProjectCoordinators**: Project → coordinators
- **ProjectContributors**: Project → contributors
- **ProjectCategories**: Project → categories
- **ProjectRequests**: Project → requests
- **ProjectOffers**: Project → offers

### 2.2 Organizations

Organizations are agents `classifiedAs` `Organization` in hREA.

#### Organization Features

- User-created entities
- Project management capabilities
- Member management
- Category classification

#### Organization Links

- **AllOrganizations**: Link to `organizations` anchor
- **OrganizationCoordinators**: Organization → coordinators
- **OrganizationMembers**: Organization → members
- **OrganizationProjects**: Organization → projects
- **OrganizationCategories**: Organization → categories
- **OrganizationRequests**: Organization → requests
- **OrganizationOffers**: Organization → offers

### 2.3 Coordinator Management

#### Responsibilities

- Project/Organization representation
- Organization/Project profile management
- Member invitation and approval
- Request/Offer management on behalf of the organization/project

#### Features

- Network administrator approval required
- Organization/Project profile customization (description, type, skills needed, etc.)
- Request/Offer creation capabilities for the organization/project
- Member invitation and approval management

## 3. Requests and Offers

### 3.1 Core Functionality

- hREA integration for economic activities
- Request creation linked to projects/organizations/skills
- Offer creation linked to requests/projects
- Implementation as hREA `intents` and `proposals`

### 3.2 Request System

#### Request Entry Structure (Current Minimal MVP)

```rust
pub struct Request {
  /// The title of the request
  pub title: String,
  /// A detailed description of the request
  pub description: String,
  /// The requirements associated with the request (formerly skills)
  pub requirements: Vec<String>,
  /// The urgency or timeframe for the request
  pub urgency: Option<String>,
}
```

*Note: The following details describe the target fields based on project planning documents (like the light paper) and may extend beyond the current minimal implementation.*

#### Request Features & Target Fields

- **Creation:** By individual users or organizations.
- **Association:** Can be associated with skills and categories.
- **Lifecycle:** Status tracking, update, and deletion capabilities.

**Target Fields:**

- **`title`**: (Text) The title of the request.
- **`type_of_service_or_skill`**: (Dropdown/Enum) Specific skill required (e.g., Testing, Editing, Rust Dev, Holochain Dev, UI/UX, Backend, Mentoring, Fundraising, Marketing, etc., including an 'Other' option requiring admin review).
- **`description`**: (Text, limited length) A detailed description of the request.
- **`preferred_contact_method`**: (Checkboxes/Set) How the requester prefers to be contacted (e.g., Email, Text, In-App).
- **`date_range`**: (Date/Time Range) Approximate timeframe when the service is needed.
- **`urgency`**: (Text/Enum) Description of when the request is needed or its urgency.
- **`date_posted`**: (Timestamp) Automatically set when the request is created.
- **`approx_time_to_complete`**: (Text/Duration) Estimated time commitment required.
- **`preferred_time_of_day`**: (Checkboxes/Set) Preferred time for exchange (e.g., Morning, Afternoon, No Preference, Other).
- **`time_zone`**: (Dropdown/Enum) Requester's time zone.
- **`preferred_exchange_preference`**: (Checkboxes/Set) How the requester prefers to reciprocate (e.g., Exchange Services, Payment [Specify Type], Pay it Forward, Open to discussion - "Hit me up, I’m open").
- **`type_of_request`**: (Checkbox/Enum) Whether the request requires virtual or in-person interaction.
- **`requirements`**: (`Vec<String>` - *Current field, potentially replaced or augmented by `type_of_service_or_skill`*) List of skills/tags.

#### Request Links

- **AllRequests**: Links to `requests` anchor (global request index)
- **UserRequests**: User → requests created by that user
- **OrganizationRequests**: Organization → requests associated with it
- **RequestCreator**: Request → its creator user profile
- **RequestOrganization**: Request → its associated organization (if any)
- **RequestUpdates**: Original request action → update actions
- **RequestSkills**: Request → required skills (future enhancement)

### 3.3 Offer System

#### Offer Entry Structure (Current Minimal MVP)

```rust
pub struct Offer {
  /// The title of the offer
  pub title: String,
  /// A detailed description of the offer
  pub description: String,
  /// The capabilities being offered (formerly skills)
  pub capabilities: Vec<String>,
  /// The availability or timeframe for the offer
  pub availability: Option<String>,
}
```

*Note: The following details describe the target fields based on project planning documents (like the light paper) and may extend beyond the current minimal implementation.*

#### Offer Features & Target Fields

- **Creation:** By individual users or organizations.
- **Association:** Can be associated with skills and categories.
- **Lifecycle:** Status tracking, update, and deletion capabilities.
- **Targeting:** Submission to specific requests (future enhancement).

**Target Fields:**

- **`title`**: (Text) The title of the offer (e.g., "Give your Service a Name").
- **`type_of_service`**: (Dropdown/Enum) Specific skill/service offered (aligns with Request skill list).
- **`description`**: (Text) A detailed description of the offer.
- **`qualifications_experience`**: (Text) Offerer's relevant background or experience.
- **`availability`**: (Checkboxes/Set) When the offerer is available (e.g., Morning, Afternoon, No Preference, Other - *Current field `availability` might map here*).
- **`time_zone`**: (Dropdown/Enum) Offerer's time zone.
- **`preferred_exchange_preference`**: (Checkboxes/Set) How the offerer prefers to reciprocate (e.g., Exchange Services, Payment [Specify Type], Pay it Forward, Open to discussion - "Hit me up, I’m open").
- **`type_of_offer`**: (Checkbox/Enum) Whether the offer involves virtual or in-person interaction.
- **`capabilities`**: (`Vec<String>` - *Current field, potentially replaced or augmented by `type_of_service`*) List of skills/tags.

#### Offer Links

- **AllOffers**: Links to `offers` anchor (global offer index)
- **UserOffers**: User → offers created by that user
- **OrganizationOffers**: Organization → offers associated with it
- **OfferCreator**: Offer → its creator user profile
- **OfferOrganization**: Offer → its associated organization (if any)
- **OfferUpdates**: Original offer action → update actions
- **OfferSkills**: Offer → capabilities offered (future enhancement)
- **OfferRequests**: Offer → requests it responds to (future enhancement)

### 3.4 Request-Offer Matching

#### Matching Process

- Manual matching in initial implementation
- Future algorithmic matching based on:
  - Skill/requirement alignment
  - Availability/urgency compatibility
  - Category alignment
  - User/organization preferences

#### Proposal Formation

- When a request and offer are matched, a proposal is formed
- Proposal represents the potential agreement between parties
- Both parties must confirm to create an agreement
- Agreement leads to commitments and economic events

#### Matching Links

- **RequestOffers**: Request → offers submitted to it
- **OfferRequests**: Offer → requests it's submitted to
- **ProposalRequest**: Proposal → originating request
- **ProposalOffer**: Proposal → originating offer

### 3.5 Exchange Completion & Validation (Target)

- **Mutual Validation:** After an exchange concludes, both the requester and offerer must validate that it was completed to their satisfaction.

- **Optional Public Review:** Both parties can post an optional review of the exchange, which will be publicly visible.

- **Feedback Metrics:** Specific feedback requested upon validation:
  - Completed on time? (Boolean/Yes/No)
  - Completed as agreed? (Boolean/Yes/No)
  - Overall Rating (Scale 0-5)

- **Dispute Resolution:** Concerns or issues should be directed to an administrator (mechanism TBD).

### 3.6 Types of Support Requested

![Types of Support Requested](../assets/images/types-of-support-requested.png)

## 4. Skills and Categories

### 4.1 Skills

Skills are implemented as Resource Specifications in hREA.

#### Skill Features

- Created through offers
- User profile integration
- Project/Request/Offer association

#### Skill Links

- **AllSkills**: Global skills index
- **SkillUsers**: Skill → users
- **SkillProjects**: Skill → projects
- **SkillRequests**: Skill → requests
- **SkillOffers**: Skill → offers

### 4.2 Categories

Categories are Resource Specifications `classifiedAs` `{category}` in hREA.

#### Category Features

- Administrator-created
- Project organization
- Offer classification
- Organization categorization

#### Category Links

- **AllCategories**: Global category index
- **CategoryProjects**: Category → projects
- **CategoryOffers**: Category → offers

### 4.5 Reporting Features

#### User Reports

- Personal exchange history
- Monthly activity summaries
- Project contribution tracking
- Skills utilization metrics

#### Administrative Reports

- Network activity metrics
- User verification status
- Project status tracking
- Exchange completion rates
- Moderation action logs

## 5. Search Functionality

### 5.1 Search Capabilities

Each major section includes search functionality:

#### User Search

- Name
- Skills
- Categories
- Location
- Organizations
- Projects

#### Project Search

- Name
- Category
- Organization
- Status
- Skills required

#### Organization Search

- Name
- Category
- Members
- Projects

#### Request/Offer Search

- Type
- Category
- Skills
- Status
- Associated project/organization

## 6. Network Administration

### 6.1 Core Administrative Features

- User and Organization verification
- Project verification
- Moderator role management
- Suspension system
- Flagging system
- Administrative inbox

### 6.2 User Interface

- Administration Dashboard
- User management interface
- Project/Organization management
- Request/Offer moderation
- Search and reporting tools

## 7. Communication and Negotiation

### 7.1 Messaging System

- **User-to-User Messaging**: Allows users to communicate directly with one another, facilitating negotiations and discussions related to requests and offers.
- **Administrative Communication**: Provides a channel for users to send messages to network administrators through an inbox within the administration panel.
- **Features**:
  - Direct messaging between users
  - Negotiation support for requests/offers
  - Administrative communication channel
  - Message history tracking
  - Agreement finalization support

### 7.2 Notification System

- **Suspension Notifications**: Users receive notifications about account suspension status and reasons
- **Exchange Updates**: Notifications for request/offer matches and updates
- **Administrative Alerts**: Important system and moderation notifications
- **Recovery Notifications**: Updates about account recovery process
