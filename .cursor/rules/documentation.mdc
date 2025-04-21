---
description: 
globs: 
alwaysApply: true
---
## Documentation Structure

The documentation resides in the `documentation/` folder, containing required core files and optional context files, all in Markdown format. Files follow a hierarchical structure, with `requirements.md` defining requirements and `technical-specs.md`/`architecture.md` providing specifications:

```mermaid
flowchart TD
    PO[project-overview.md] --> RQ[requirements.md]
    PO --> AR[architecture.md]
    PO --> TS[technical-specs.md]
    
    RQ --> WIP[work-in-progress.md]
    AR --> WIP
    TS --> WIP
    
    WIP --> ST[status.md]
```

### Core Files (Required)

1. `project-overview.md`

   - The foundational document summarizing the project’s scope, goals, and core context.
   - Created at project start if absent, using the existing documentation pattern (e.g., headers, tone, structure) or improving clarity while maintaining consistency.
   - Acts as the source of truth, linking to `requirements.md` (requirements) and `technical-specs.md`/`architecture.md` (specifications).

2. `requirements.md` **(Requirements)**

   - Defines the project’s requirements: why it exists, problems it solves, user experience goals, and high-level functionality.
   - Captures the "what" and "why" from a user and business perspective (e.g., user needs, features, success criteria).
   - Mirrors the style and depth of existing documentation (e.g., user story format, feature lists), enhancing clarity or structure while staying consistent with the established pattern.

3. `work-in-progress.md`

   - Tracks current work focus, recent changes, next steps, and active decisions, bridging requirements and specifications.
   - Adheres to the existing format (e.g., bullet points, decision logs) and improves conciseness or organization while maintaining consistency.

4. `architecture.md` **(Specifications - Architecture)**

   - Specifies the system’s architecture: design patterns, key technical decisions, component relationships, and system structure.
   - Part of the technical specifications, detailing "how" the requirements are implemented at an architectural level.
   - Follows the technical style of existing documentation (e.g., Mermaid diagrams, technical terminology), refining explanations or visuals for clarity while preserving the established structure.

5. `technical-specs.md` **(Specifications - Technical Foundation)**

   - Specifies the technical foundation: technologies used, development setup, dependencies, and constraints.
   - Complements `architecture.md` to form complete technical specifications for meeting the requirements.
   - Matches the existing format (e.g., tables, lists) and enhances precision or updates outdated information while maintaining consistency.

6. `status.md`

   - Summarizes implementation status: what works, tasks remaining, current state, and known issues.
   - Tracks progress toward meeting requirements and adhering to specifications.
   - Aligns with the existing progress tracking style (e.g., task lists, issue tables), improving specificity or readability without altering the core approach.

### Additional Context

- Create additional files or subfolders within `documentation/` (e.g., `documentation/features/`, `documentation/api/`) for:
  - Detailed requirements (e.g., feature-specific user needs).
  - Detailed specifications (e.g., API contracts, integration details).
  - Testing strategies, deployment procedures, or other supporting documentation.
- New files **MUST** follow the tone, structure, and style of existing documentation, categorized as requirements (user-focused) or specifications (technical) where applicable, with improvements to clarity or organization that remain consistent with the established pattern.

## Core Workflows

### Ask Mode

```mermaid
flowchart TD
    Start[Start] --> ReadFiles[Read Documentation and Rules]
    ReadFiles --> CheckFiles{Files Complete?}
    
    CheckFiles -->|No| Plan[Create Plan]
    Plan --> Document[Document in Chat]
    
    CheckFiles -->|Yes| Verify[Verify Context]
    Verify --> Strategy[Develop Strategy]
    Strategy --> Present[Present Approach]
```

- **Read Documentation and Rules**: Analyze all files in `documentation/` and applicable rules in `.cursor/rules/` to understand project context.
- **Check Files**: If core files (`project-overview.md`, `requirements.md`, etc.) are missing, propose creating them based on existing documentation patterns.
- **Plan and Present**: Develop a strategy aligned with the documentation style (requirements in `requirements.md`, specifications in `technical-specs.md`/`architecture.md`) and `.cursor/rules/`, presenting it for approval.

### Agent Mode

```mermaid
flowchart TD
    Start[Start] --> Context[Check Documentation and Rules]
    Context --> Update[Update Documentation]
    Update --> Rules[Update .cursor/rules/ if needed]
    Rules --> Execute[Execute Task]
    Execute --> Document[Document Changes]
```

- **Check Documentation and Rules**: Read all `documentation/` files and applicable `.cursor/rules/` files to establish context.
- **Update Documentation**: Document changes in the appropriate files (e.g., `work-in-progress.md`, `status.md`), mimicking the existing style and improving where possible (e.g., clearer headings, better examples).
- **Update Rules**: Create or modify `.mdc` files in `.cursor/rules/` if new patterns emerge, ensuring consistency with existing rules and using the `.mdc` format.
- **Execute Task**: Implement tasks, ensuring code and documentation align with requirements (`requirements.md`), specifications (`technical-specs.md`, `architecture.md`), and `.cursor/rules/`.
- **Document Changes**: Update relevant files with changes, following the existing format.

## Documentation Updates

Documentation updates occur when:

1. Discovering new project patterns or insights.
2. After implementing significant changes.
3. When the user requests with **update documentation** (MUST review ALL files in `documentation/`).
4. When context needs clarification or existing documentation lacks clarity.

```mermaid
flowchart TD
    Start[Update Process]
    
    subgraph Process
        P1[Review ALL Files]
        P2[Analyze Existing Patterns]
        P3[Document Current State]
        P4[Clarify Next Steps]
        P5[Update .cursor/rules/]
        
        P1 --> P2 --> P3 --> P4 --> P5
    end
    
    Start --> Process
```

- **Review ALL Files**: Examine every file in `documentation/` and applicable `.mdc` files in `.cursor/rules/` to ensure completeness and consistency.
- **Analyze Existing Patterns**: Identify the tone, structure, and style (e.g., user stories in `requirements.md`, diagrams in `architecture.md`) of current documentation and rules.
- **Document Current State**: Update files to reflect changes, mimicking the existing pattern and improving clarity or organization where possible.
- **Clarify Next Steps**: Ensure `work-in-progress.md` and `status.md` clearly outline future work in the established style.
- **Update .cursor/rules/**: Create or modify `.mdc` files in `.cursor/rules/` to capture new insights or patterns, aligning with the existing rules format.

**Note**: For **update documentation** requests, I MUST review all files, even if some don’t require changes. Focus on `work-in-progress.md` and `status.md` for current state updates, ensuring improvements align with the existing documentation pattern.

## Project Intelligence (.cursor/rules/)

The `.cursor/rules/` folder contains project-specific rules in `.mdc` files, providing instructions for the Agent to follow when generating code or assisting with tasks. These rules enhance my effectiveness by codifying project patterns, preferences, and context, as per the Cursor Rules documentation.

```mermaid
flowchart TD
    Start{Discover New Pattern}
    
    subgraph Learn [Learning Process]
        D1[Identify Pattern]
        D2[Validate with User]
        D3[Document in .cursor/rules/]
    end
    
    subgraph Apply [Usage]
        A1[Read .cursor/rules/]
        A2[Apply Learned Patterns]
        A3[Improve Future Work]
    end
    
    Start --> Learn
    Learn --> Apply
```

### What to Capture

- Critical implementation paths (e.g., preferred file structures).
- User preferences (e.g., documentation style, update frequency).
- Project-specific patterns (e.g., naming conventions, testing approaches).
- Known challenges and solutions.
- Evolution of project decisions.
- Tool usage patterns.
- Documentation patterns (e.g., “`requirements.md` uses user stories; `architecture.md` includes Mermaid diagrams”).

### Rule File Format

- Rules are stored as `.mdc` files in `.cursor/rules/` (e.g., `base.mdc`, `frontend.mdc`).

- Each `.mdc` file includes metadata (e.g., description, globs, alwaysApply) and content, following the format:

  ```
  --- 
  description: Base project rules
  globs: **/* 
  alwaysApply: true 
  ---
  - Follow coding standards defined in @documentation/technical-specs.md
  - Use user story format for requirements in @documentation/requirements.md
  ```

- Use glob patterns to scope rules (e.g., `app/**/*.ts` for TypeScript files).

- Support rule types: “Always” (always applied), “Auto Attached” (applied when files match globs), “Agent Requested” (applied based on intent), or “Manual” (explicitly attached).

- Reference other files with `@file` (e.g., `@documentation/architecture.md`) for additional context.

- Support inheritance by referencing other `.mdc` files (e.g., `@base.mdc`).

### Documentation-Specific Rules

- Include insights about the preferred documentation style for requirements (`requirements.md`) and specifications (`technical-specs.md`, `architecture.md`).

- Document user feedback on documentation improvements (e.g., “prefer concise requirements”).

- Ensure rules reflect how to maintain consistency with the existing `documentation/` pattern and the requirements/specifications distinction.

- Example rule:

  ```
  --- 
  description: Documentation standards
  globs: documentation/**/*
  alwaysApply: false 
  ---
  - Mimic existing Markdown style in @documentation/ for new files
  - Use Mermaid diagrams in @documentation/architecture.md for system design
  - Validate requirements in @documentation/requirements.md before updating specifications
  ```

### Management

- Create new rules via `Cmd + Shift + P > New Cursor Rule` or manually in `.cursor/rules/`.
- Update rules when new patterns emerge, ensuring they align with existing `.mdc` files.
- Use inheritance to keep rules modular (e.g., a `base.mdc` for general rules, `frontend.mdc` for frontend-specific rules).
- Store `.cursor/rules/` in the repository for version control and team consistency.

## Planning

When entering **Ask Mode**, I will:

1. Deeply analyze the requested changes and existing code to map the full scope.
2. Read all `documentation/` files and applicable `.mdc` files in `.cursor/rules/` to understand the current pattern and context (requirements in `requirements.md`, specifications in `technical-specs.md`/`architecture.md`).
3. Ask 4-6 clarifying questions based on my findings, ensuring alignment with the existing documentation style, requirements/specifications framing, and `.cursor/rules/`.
4. Draft a comprehensive plan of action, including how documentation and `.cursor/rules/` will be updated to match the existing pattern with improvements.
5. Present the plan for approval, ensuring 6. Present the plan for approval, ensuring documentation changes are clearly outlined.

In **Agent Mode**, I will:

1. Implement the approved plan, ensuring all code and documentation changes align with the existing `documentation/` pattern, requirements/specifications, and `.cursor/rules/`.
2. After each phase/step, report what was completed, the next steps, and remaining phases.
3. Update `documentation/` files (e.g., `work-in-progress.md`, `status.md`) and `.cursor/rules/` to reflect changes, mimicking the existing style and improving clarity or structure where possible.