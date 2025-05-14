---
description: Continue work on a task list created with the write-a-plan workflow
---

# Continue Task List Workflow

This workflow provides a structured approach to continue working on a task list created with the write-a-plan workflow.

## Initial Context Gathering

1. Identify the task list file to continue working on:
   - Typically located in `documentation/task-lists/[feature-name]-task-list.md`

2. Read the core documentation to understand the project context:
   - `documentation/project-overview.md` - For overall project scope and goals
   - `documentation/requirements.md` - For user and business requirements
   - `documentation/architecture.md` - For system design and component relationships
   - `documentation/technical-specs.md` - For technical foundation and dependencies
   - `documentation/work-in-progress.md` - For current work focus and recent changes
   - `documentation/status.md` - For implementation status and known issues

3. Review the task list file to understand:
   - The feature being implemented
   - Completed tasks
   - In-progress tasks
   - Future tasks
   - Implementation plan
   - Relevant files

4. Read the Github issue if specified to get more context about it.

## Codebase Analysis

1. Analyze the relevant files mentioned in the task list:
   - Review file structure and relationships
   - Understand the implementation patterns
   - Identify dependencies and interfaces

2. Explore related code not explicitly mentioned in the task list:
   - Search for similar patterns or components
   - Look for utility functions or services that might be useful
   - Check for tests that might need updating

3. Identify the next task to implement:
   - Look for tasks marked as "In Progress"
   - If no tasks are marked as in progress, select the next logical task from "Future Tasks"
   - Consider dependencies between tasks when selecting the next one

## Implementation Process

1. Before starting implementation:
   - Update the task list to mark the selected task as "In Progress"
   - Add any new subtasks identified during analysis
   - Ensure the "Relevant Files" section is up to date

2. During implementation:
   - Follow the project's coding standards and patterns
   - Create or modify files as needed
   - Add unit tests and integration tests as appropriate
   - Document code with comments as needed

3. After completing a task:
   - Move the task from "In Progress" to "Completed"
   - Add any new tasks discovered during implementation
   - Update the "Relevant Files" section with new or modified files

## Regular Task List Updates

1. Update the task list after completing significant components:
   - Mark completed tasks with [x]
   - Add new tasks discovered during implementation
   - Move tasks between sections as appropriate
   - Update file paths and descriptions in the "Relevant Files" section

2. Document implementation details:
   - Add architecture decisions
   - Describe data flow
   - List technical components
   - Note any environment configuration changes

3. Example task update:

   ```markdown
   ## In Progress Tasks

   - [ ] Create API endpoints for data access

   ## Completed Tasks

   - [x] Set up project structure
   - [x] Configure environment variables
   - [x] Implement database schema
   ```

## Documentation Updates

1. Always include a final section in your task list for documentation updates:

   ```markdown
   ## Documentation Updates

   - [ ] Update architecture.md with new component relationships
   - [ ] Update technical-specs.md with new dependencies
   - [ ] Update work-in-progress.md with current focus
   - [ ] Update status.md with implementation progress
   ```

2. After implementing significant features or completing a set of tasks:
   - Update `architecture.md` with any new components or relationships
   - Update `technical-specs.md` with new dependencies or technical decisions
   - Update `work-in-progress.md` with current focus and recent changes
   - Update `status.md` with implementation progress and known issues

3. Ensure documentation updates are tracked in the task list:
   - Add specific documentation tasks as needed
   - Mark documentation tasks as completed when done
   - Consider documentation updates as part of the feature implementation

## Continuous Improvement

1. Regularly review the task list for:
   - Tasks that may be obsolete or redundant
   - Tasks that may need to be broken down further
   - Tasks that may need to be reprioritized

2. Update the task list structure if needed:
   - Add new sections for specific components or phases
   - Improve task descriptions for clarity
   - Add more detailed implementation notes

3. Ensure the task list remains a useful tool for tracking progress:
   - Keep it up to date with the current state of implementation
   - Use it to communicate progress and next steps
   - Refer to it when planning future work
