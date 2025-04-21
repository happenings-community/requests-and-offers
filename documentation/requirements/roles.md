# Roles and Permissions Specifications

## 1. User Roles

### 1.1 Advocate

- **Onboarded/Approved**: Advocates are individuals passionate about the Holochain technology, looking to support projects within the ecosystem. They are onboarded and approved to participate in the network by the network's administrators.
- **User Profile**: Advocates must file out their user profiles, including essential information and their areas of expertise.
- **Offers**: Advocates can offer their skills, talents, or resources to the network. This includes mentorship, brainstorming sessions, or any other form of support they wish to provide.
- **Reporting**: Advocates have access to reporting features, allowing them to view their exchanges and a general report of total exchanges for the month.

### 1.2 Creator

- **Onboarded/Approved**: Creators are individuals or groups actively involved in creating or developing projects within the Holochain ecosystem. They are onboarded and approved to participate in the network by the network's administrators.
- **User Profile**: Creators can file out their user profiles, including their skills, location, type, etc.
- **Offers**: Creators can make offers, including the skills and talents they wish to offer.
- **Requests**: Creators can make requests for themselves, such as mentoring, brainstorming time, or testing in the early days of their projects.
- **Reporting**: Creators can access reports on their exchanges and a general report of total exchanges for the month.

### 1.3 Projects and Organizations Coordinators

- **Onboarded/Approved**: Projects and organizations coordinators are individuals or groups designated to represent a project or organization within the network. They are onboarded and approved to participate in the network.
- **Project Profile**: Projects and organizations coordinators can file out the project profile, including the skills involved, location, type, etc.
- **Offers**: Projects and organizations coordinators can make offers for themselves and on behalf of their projects or organizations, such as:
  - Development resources (e.g., reusable Holochain zomes, UI components)
  - Testing environments or infrastructure
  - Documentation support or translation services
  - Community building and engagement resources
  - Training or workshop sessions about their project
  - Collaborative development opportunities
  - Beta testing participation opportunities
- **Requests**: Projects and organizations coordinators can make requests for themselves and on behalf of their projects or organizations, such as:
  - Technical expertise (Rust/Holochain development, UI/UX)
  - Code review and architecture feedback
  - Testing and quality assurance
  - Documentation assistance
  - Translation services
  - Community outreach support

### 1.4 Matchmaker (Future Role)

- **Description**: A role that could be added in future versions to facilitate the matching of requests and offers more efficiently.

## 2. Administrative Roles

### 2.1 Administrator

- **Access**: Full access to Administration Zome and UI
- **Responsibilities**:
  - User and Organization verification
  - Project verification
  - Administrator management
  - Suspension management
  - System configuration
  - Full reporting access

### 2.2 Moderator

- **Access**: Limited access to Administration Zome and UI
- **Responsibilities**:
  - Content moderation
  - User support
  - Report handling
  - Cannot manage administrators

## 3. Role Management

### 3.1 Role Assignment

- **Progenitor Pattern**: 
  - First agent in the network is designated as progenitor
  - Upon user profile creation, progenitor automatically becomes first administrator
  - Establishes initial administrative control
- **Administrator Assignment**: By existing administrators
- **Moderator Assignment**: By administrators
- **Role Verification**: Through anchor system

### 3.2 Access Control

#### Administrators
- **AdministratorsUser**: Link from `administrators` anchor to user
- **Full System Access**: Complete control over all system aspects

#### Moderators
- **ModeratorsUser**: Link from `moderators` anchor to user
- **Limited Access**: All admin functions except administrator management

### 3.3 Suspension System

- **Temporary Suspension**: Time-limited account restrictions
- **Indefinite Suspension**: Permanent account restrictions
- **Suspension Management**:
  - Reason documentation
  - History tracking
  - Notification system:
    - Initial suspension notification with reason
    - Duration notification for temporary suspensions
    - End of suspension notification
    - Appeal process updates
  - Unsuspension process

### 3.4 Communication Channels

- **Administrative Inbox**: Direct communication channel with administrators
- **Moderation Queue**: For handling reported content and issues
- **Support System**: For handling user inquiries and appeals
- **Notification System**: For administrative updates and actions

### 3.5 Flagging System

- **User Flagging Rights**: Users can flag organizations, projects, requests, and offers
- **Review Process**: Flagged content undergoes administrative review
- **Action Types**:
  - Content review
  - User warnings
  - Content removal
  - Account suspension
- **Tracking**: Maintain history of flags and resolutions
