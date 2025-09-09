---
description: Strategic GitHub project management with intelligent automation, leveraging your existing P1/P2/P3 priority system and milestone structure. Provides planning intelligence while delegating GitHub CLI operations to @agent-project-board-manager for optimal execution.

allowed-tools: Bash(git describe:*), Bash(git log:*), Bash(git diff:*), Read, Edit, mcp__pieces__ask_pieces_ltm, mcp__pieces__create_pieces_memory
---

# /project - GitHub Project Management Command

## Purpose

Strategic GitHub project management with intelligent automation, leveraging your existing P1/P2/P3 priority system and milestone structure. Provides planning intelligence while delegating GitHub CLI operations to @agent-project-board-manager for optimal execution.

## Usage

```
/project [operation] [target] [--priority P1|P2|P3] [--milestone name] [--template type]
```

**Agent Integration**: All GitHub CLI operations automatically delegated to @agent-project-board-manager while providing strategic planning, templates, and coordination.

## Operations

### Core Operations

- `status` - Comprehensive project overview with progress metrics
- `create-issue` - Create structured issue with intelligent templates
- `update-issue` - Update issue with progress tracking and status management
- `breakdown` - Decompose large issues into manageable sub-tasks
- `setup-board` - Initialize project board with workflow automation
- `sync` - Synchronize local project state with GitHub board

### Milestone Management

- `create-milestone` - Create milestone with deliverable planning
- `milestone-status` - Track milestone progress and completion
- `milestone-plan` - Strategic milestone planning with issue distribution

### Automation Setup

- `setup-templates` - Create issue templates matching your domain patterns
- `setup-workflows` - Configure GitHub Actions for project automation
- `setup-labels` - Standardize label system based on current patterns

## Priority System (Based on Current Structure)

### P1-critical (Immediate Action)

- **Scope**: MVP blockers, core functionality, production issues
- **Current**: 9 issues - Core system components and essential features
- **Timeline**: Current milestone priority
- **Auto-assign**: Current milestone, high-priority labels

### P2-high (Important Features)

- **Scope**: Important enhancements, system improvements, user experience
- **Current**: 11 issues - Feature development and quality improvements
- **Timeline**: Next 1-2 milestones
- **Auto-assign**: Milestone based on complexity and dependencies

### P3-medium (Future Enhancements)

- **Scope**: Nice-to-have features, optimizations, tech debt
- **Current**: 4 issues - Future improvements and polish
- **Timeline**: Future milestones, flexible scheduling
- **Auto-assign**: Later milestones, good-first-issue candidates

## Domain Integration (Matching Current Labels)

### Frontend Domain (`frontend`, `ui` labels)

- **Current**: 20 issues across UI/UX development
- **Patterns**: Component development, responsive design, accessibility
- **Auto-detection**: `*.svelte`, `*.tsx`, `*.css`, UI component keywords
- **Templates**: Component creation, UI enhancement, design system

### Backend Domain (`backend`, `hREA` labels)

- **Current**: 13 issues across server-side development
- **Patterns**: Holochain zomes, hREA integration, API development
- **Auto-detection**: `*.rs`, zome patterns, Holochain keywords
- **Templates**: Zome implementation, API enhancement, integration

### Cross-Domain (`epic` label)

- **Current**: 2 large features requiring coordination
- **Patterns**: Multi-component features, architectural changes
- **Auto-detection**: Epic scope indicators, multiple domain impact
- **Templates**: Epic breakdown, milestone planning, dependency tracking

## Milestone Progression (Based on Current Structure)

### Alpha Milestones

- **v0.1.0-alpha.6**: Core functionality + UX improvements (4 issues)
- **v0.1.0-alpha.7**: System modernization + hREA completion (4 issues)

### Release Milestones

- **v0.1.0-release**: Production-ready application (4 issues)
- **v0.2.0**: Post-stable enhancements (3 issues)
- **v1.0.0**: Major version with significant features (4 issues)

## Command Operations

### Project Status Overview

```bash
/project status
```

**Strategic Analysis**:

1. **Milestone Progress**: Visual progress tracking across all 5 milestones
2. **Priority Distribution**: P1/P2/P3 breakdown with completion metrics
3. **Domain Balance**: Frontend vs Backend work distribution
4. **Velocity Tracking**: Issue completion rate and milestone projections
5. **Blocker Identification**: Dependency analysis and critical path issues

**Agent Delegation**: @agent-project-board-manager gathers GitHub data, command provides analysis and strategic insights.

### Issue Creation with Intelligence

```bash
/project create-issue "User authentication flow enhancement" --priority P2 --milestone "v0.1.0-alpha.7" --domain backend
```

**Strategic Planning**:

1. **Context Analysis**: Review similar issues and implementation patterns
2. **Template Selection**: Choose appropriate template based on domain and complexity
3. **Priority Validation**: Ensure priority aligns with milestone goals
4. **Dependency Detection**: Identify blocking or related issues
5. **Label Intelligence**: Auto-assign domain, type, and complexity labels

**Agent Execution**: @agent-project-board-manager creates GitHub issue with structured metadata and project board integration.

### Epic Breakdown

```bash
/project breakdown 42 --milestone "v0.1.0-release" --subtasks 4
```

**Strategic Decomposition**:

1. **Complexity Analysis**: Assess epic scope and implementation requirements
2. **Logical Separation**: Identify 3-5 coherent sub-tasks with clear boundaries
3. **Dependency Mapping**: Establish execution order and inter-task relationships
4. **Priority Inheritance**: Distribute priorities based on epic importance and timeline
5. **Milestone Distribution**: Align sub-tasks with milestone capacity and focus

**Agent Coordination**: @agent-project-board-manager creates linked sub-issues with parent relationships and board organization.

### Project Board Setup

```bash
/project setup-board --workflow kanban --automation high
```

**Board Architecture**:

1. **📋 Backlog**: P3-medium issues, future milestones, planning items
2. **🎯 Ready**: P1/P2 issues assigned to current milestone, ready for work
3. **🔄 In Progress**: Active development, assigned to team members
4. **👀 Code Review**: Pull requests submitted, testing and validation
5. **✅ Done**: Completed issues, merged PRs, milestone contributions

**Automation Rules**:

- P1 issues → Auto-move to Ready column
- Issue assignment → Auto-move to In Progress
- PR creation → Auto-move to Code Review
- PR merge → Auto-move to Done, auto-close issue

**Agent Implementation**: @agent-project-board-manager creates project board structure and configures automation workflows.

## Issue Templates (Optimized for Current Patterns)

### Standard Feature Template

```markdown
## Goal

[Clear objective aligned with milestone deliverables]

## Priority Justification

- **P1**: Blocks milestone completion or core functionality
- **P2**: Important for milestone goals, enhances user experience
- **P3**: Future enhancement, improves system quality

## Domain Classification

- [ ] **Frontend** (`frontend`, `ui`): UI components, user experience
- [ ] **Backend** (`backend`, `hREA`): Zomes, API, Holochain integration
- [ ] **Cross-Domain** (`epic`): Multiple components, architectural changes

## Implementation Tasks

- [ ] **Analysis**: Requirements analysis and technical design
- [ ] **Development**: Core implementation following domain patterns
- [ ] **Testing**: Unit tests, integration tests, manual validation
- [ ] **Documentation**: Update relevant docs and examples
- [ ] **Integration**: Merge and deploy to staging environment

## Acceptance Criteria

- [ ] Functional requirements met with evidence
- [ ] Follows established architectural patterns
- [ ] Test coverage ≥80% for new code
- [ ] Performance impact assessed and acceptable
- [ ] Security implications reviewed and addressed

## Milestone Alignment

**Target**: [milestone-name] - [brief justification for timeline]
**Dependencies**: List any blocking issues or requirements
**Impact**: How this contributes to milestone goals

## Technical Notes

[Implementation approach, architectural considerations, constraints]
```

### Epic Template (For Complex Features)

```markdown
## Epic Overview

[High-level feature description and business value]

## Milestone Strategy

- **Primary Milestone**: [main delivery milestone]
- **Secondary Milestones**: [follow-up enhancements]
- **Timeline**: [realistic completion estimate]

## Sub-Issue Breakdown

- [ ] #issue - [Component 1]: [Brief description]
- [ ] #issue - [Component 2]: [Brief description]
- [ ] #issue - [Component 3]: [Brief description]
- [ ] #issue - [Integration]: [Testing and deployment]

## Cross-Domain Impact

- **Frontend Changes**: [UI components, user flows]
- **Backend Changes**: [Zomes, API modifications]
- **Integration Points**: [hREA, external systems]

## Success Metrics

- [Quantifiable completion criteria]
- [Performance benchmarks if applicable]
- [User experience improvements]

## Risk Assessment

- **Technical Risks**: [Implementation challenges]
- **Timeline Risks**: [Potential delays]
- **Mitigation Strategies**: [Risk reduction approaches]
```

## Automation Workflows

### Label Management (Based on Current System)

**Domain Auto-Assignment**:

```yaml
frontend_files: ["*.svelte", "*.tsx", "*.css", "ui/**"]
backend_files: ["*.rs", "zomes/**", "dnas/**"]
labels:
  - frontend: UI components, user experience, responsive design
  - backend: Holochain development, zomes, hREA integration
  - ui: User interface improvements, design system
  - hREA: Framework integration, resource-event-agent patterns
```

**Priority Auto-Escalation**:

```yaml
priority_rules:
  P1_keywords: ["blocker", "critical", "production", "security"]
  P2_keywords: ["important", "milestone", "user experience"]
  P3_keywords: ["enhancement", "optimization", "nice-to-have"]
milestone_assignment:
  P1: current_milestone
  P2: next_1_to_2_milestones
  P3: future_milestones
```

### Milestone Automation

**Progress Tracking**:

- **Completion Metrics**: (Closed issues / Total issues) per milestone
- **Velocity Calculation**: Issues completed per week, projected completion
- **Priority Distribution**: P1/P2/P3 balance within each milestone
- **Domain Balance**: Frontend/Backend work distribution

**Auto-Milestone Assignment**:

- P1 issues → Current active milestone
- New issues → Suggested milestone based on priority and capacity
- Epic breakdown → Sub-issues inherit parent milestone unless specified

## Agent Integration Architecture

### Strategic Command ↔ Execution Agent

**Command Responsibilities**:

- Context analysis and strategic planning
- Template selection and issue structure design
- Priority assessment and milestone alignment
- Pattern recognition and automation suggestions
- Quality validation and process improvement

**@agent-project-board-manager Responsibilities**:

- GitHub CLI operations and API interactions
- Project board management and automation setup
- Issue creation, updates, and relationship management
- Workflow configuration and maintenance
- Status reporting and metrics collection

### Communication Protocol

**Request Structure**:

```yaml
operation: create-issue|update-issue|setup-board|milestone-status
context:
  priority_system: P1|P2|P3
  current_milestone: milestone_name
  domain_focus: frontend|backend|epic
  automation_level: minimal|standard|high
data:
  title: "Structured issue title"
  body: "Template-based markdown content"
  labels: ["domain", "priority", "type"]
  milestone: "milestone-name"
  assignee: "team-member"
validation:
  template_compliance: boolean
  priority_justification: string
  milestone_alignment: boolean
```

**Response Validation**:

- Confirm issue creation with correct metadata structure
- Validate project board integration and column placement
- Verify label assignment matches domain and priority patterns
- Ensure milestone capacity and balance maintained

## Usage Examples

### Strategic Project Overview

```bash
/project status --detailed --milestone "v0.1.0-alpha.6"
```

**Output**:

- Progress: 3/4 issues completed (75%)
- Priority breakdown: 2 P1, 1 P2, 1 P3
- Domain distribution: 2 frontend, 2 backend
- Projected completion: 2 weeks based on current velocity
- Blockers: None identified
- Next actions: Complete remaining P1 issue, prepare alpha.7 planning

### Create Prioritized Feature

```bash
/project create-issue "Responsive dashboard layout for mobile devices" --priority P2 --milestone "v0.1.0-alpha.6" --domain frontend
```

**Strategic Processing**:

1. Analyzes frontend patterns in current issues
2. Selects UI enhancement template
3. Auto-assigns `frontend`, `ui`, `P2-high` labels
4. Validates milestone capacity (currently 4/4 issues)
5. Suggests alternative milestone or priority adjustment if needed

**Agent Execution**: Creates GitHub issue with structured template and project board integration.

### Epic Decomposition

```bash
/project breakdown 38 --milestone "v0.1.0-release" --max-subtasks 4
```

**Strategic Analysis**:

1. Reviews epic scope and complexity (example: "Complete user authentication system")
2. Identifies logical components: OAuth integration, user profiles, permissions, session management
3. Maps dependencies: OAuth → profiles → permissions → sessions
4. Distributes across milestone capacity and timeline
5. Assigns appropriate priorities based on critical path

**Agent Coordination**: Creates 4 linked sub-issues with dependency relationships and board organization.

### Milestone Planning

```bash
/project milestone-plan "v0.2.0" --capacity 5 --focus enhancement --timeline "4-weeks"
```

**Strategic Planning**:

1. Analyzes current P2/P3 backlog for enhancement opportunities
2. Balances frontend/backend work distribution
3. Considers team velocity and realistic timeline
4. Proposes issue selection based on value and complexity
5. Creates milestone with curated issue set

**Agent Implementation**: Creates milestone and moves selected issues with proper organization.

## Quality Gates and Validation

### Issue Creation Standards

**Template Compliance**:

- All required sections completed with relevant content
- Priority justification aligns with P1/P2/P3 criteria
- Domain classification matches file patterns and scope
- Milestone alignment supports strategic delivery goals

**Metadata Validation**:

- Labels reflect domain, priority, and type accurately
- Milestone assignment considers capacity and timeline
- Dependencies identified and properly linked
- Acceptance criteria are testable and measurable

### Milestone Planning Standards

**Strategic Alignment**:

- Issue distribution supports milestone objectives
- Priority balance ensures critical work completion
- Domain balance maintains team productivity
- Timeline realistic based on historical velocity

**Capacity Management**:

- Maximum 5-7 issues per milestone for focus
- P1 issues limited to critical path items
- Buffer time included for unexpected issues
- Dependencies resolved before milestone start

## Integration with Claude Code Workflow

### TodoWrite Coordination

**Issue → Todo Conversion**:

```bash
/project sync-todos --milestone current --active-only
```

Converts active GitHub issues to session-level todos for development focus.

### Progress Documentation

**Implementation Evidence**:

- Automatic issue updates with development progress
- Code change linking to relevant issues
- Test results and validation evidence
- Documentation updates and completion verification

### Quality Enforcement

**Pre-Completion Validation**:

- All acceptance criteria verified with evidence
- Test coverage requirements met
- Security implications assessed
- Performance impact documented

### Memory Integration

**Pattern Learning**:

- Document successful issue breakdown strategies
- Preserve effective milestone planning approaches
- Learn from team velocity and estimation accuracy
- Improve template effectiveness based on outcomes

`★ Insight ─────────────────────────────────────`
This command leverages your existing organizational excellence while adding the missing workflow automation. The P1/P2/P3 system becomes the foundation for intelligent prioritization, and the milestone progression guides strategic planning. The agent handles GitHub mechanics while the command provides the strategic intelligence.
`─────────────────────────────────────────────────`

## Performance Metrics

### Success Criteria

- **Planning Accuracy**: <20% variance between estimated and actual milestone completion
- **Priority Effectiveness**: >85% of P1 issues completed within target milestone
- **Workflow Efficiency**: >90% of issues follow standard board progression
- **Team Velocity**: Consistent issue completion rate with improving predictability

### Automation Benefits

- **Label Accuracy**: >90% correct automatic domain and priority assignment
- **Template Adoption**: >80% of issues use appropriate templates
- **Milestone Balance**: Maintain 3-5 issue optimal capacity per milestone
- **Dependency Tracking**: >85% accurate blocking relationship identification

This command transforms your well-organized manual process into an intelligent, automated project management system while preserving the strategic thinking and quality standards that make your current approach effective.
