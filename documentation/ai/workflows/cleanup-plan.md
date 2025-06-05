---
description: How to clean up and refine an existing task list (plan)
---

# Clean Up Plan Workflow

This workflow outlines the steps to review, refine, and clean up an existing task list (plan) to ensure it remains concise, up-to-date, and focused on essential information. This is useful when a task list has grown large or contains outdated information.

## 1. Understand the Current Plan and Context

Before making changes, gain a thorough understanding of the existing plan and its context:

1.  **Read the entire task list file** that needs cleaning. Pay attention to all sections: Completed, In Progress, Future Tasks, Implementation Plan, and Relevant Files.
2.  **Review linked GitHub Issues**: If the task list references GitHub issues (e.g., `Fixes #123` or `Related to #456`), use the GitHub MCP to fetch and read the details of these issues to understand their scope and current status.
3.  **Analyze Linked Files**: Review the files mentioned in the "Relevant Files" section or those implied by the tasks. Understand their purpose and the changes made or planned.
4.  **Consult Documentation and Rules**:
    *   Read relevant general project documentation from the `documentation/` folder (e.g., `project-overview.md`, `architecture.md`, `technical-specs.md`) to align the plan with the broader project context.
    *   Review applicable rules and guidelines from `documentation/ai/rules/` to ensure the plan and its described implementation details adhere to current standards and patterns.

## 2. Refine "Completed Tasks" Section

The goal is to make this section a clear summary of achievements rather than an exhaustive list of every small step.

1.  **Summarize Accomplishments**: Group related small completed tasks into larger, more meaningful achievements. For example, instead of listing ten minor UI tweaks, summarize them as "Enhanced user profile UI components."
2.  **Maintain Traceability of Key Changes**: While summarizing, ensure that significant outcomes and modifications to key files are still traceable. For instance, "Implemented user authentication (modified `authService.ts`, `userStore.ts`)."
3.  **Remove Redundancy**: If details of completed tasks are well-documented elsewhere (e.g., in commit messages or specific documentation pages), a brief summary here is sufficient.

## 3. Update "Implementation Plan / Details" Section

This section should provide a concise and current overview of the technical approach.

1.  **Ensure Conciseness**: Remove verbose descriptions. Focus on the essential architectural decisions, patterns used, and key technical components.
2.  **Reflect Current Reality**: Update the plan to match the *actual* implementation if it diverged from the original plan. Document any new patterns or architectural decisions that have solidified during development.
3.  **Remove Outdated Information**: Delete any details about approaches that were considered but not taken, or plans that have become obsolete.

## 4. Update "Relevant Files" Section

Keep this list accurate and focused on files central to the ongoing and future tasks.

1.  **Verify Accuracy**: Ensure all listed files are still relevant to the remaining tasks or represent significant parts of the completed work that are important for context.
2.  **Remove Obsolete Entries**: Delete files that are no longer relevant, or whose changes are now part of a summarized completed task and don't need individual highlighting for future work.
3.  **Concise Descriptions**: Ensure the purpose/description of each file is brief and accurate.

## 5. Refine "In Progress Tasks" Section

This section should clearly show what is actively being worked on.

1.  **Confirm Relevance**: Ensure all tasks listed are genuinely in progress.
2.  **Clarity and Scope**: Rephrase tasks if they are unclear. If a task is too large, consider whether it should be broken down in the context of future work (or if sub-steps were implicitly completed).

## 6. Refine "Future Tasks" Section

This section should be a clear roadmap of what's next.

1.  **Review for Relevance**: Assess each future task. Is it still planned? Is it still a priority?
2.  **Enhance Clarity and Actionability**: Rephrase tasks to be clear, specific, and actionable. For example, instead of "Improve API," use "Refactor API endpoint X for performance" or "Add pagination to API endpoint Y."
3.  **Remove Obsolete Tasks**: Delete tasks that are no longer planned, have been superseded by other work, or are no longer relevant due to changes in project direction.
4.  **Add Emergent Tasks**: Incorporate any new tasks that have been identified as necessary from recent work or planning sessions.
5.  **Prioritize (Optional)**: If appropriate, re-order future tasks to reflect current priorities.

## 7. Review and Finalize

1.  **Holistic Review**: Read through the entire cleaned-up task list. Does it flow logically? Is it easy to understand the feature's status and what remains to be done?
2.  **Check for Consistency**: Ensure terminology and level of detail are consistent across sections.
3.  **Confirm Alignment**: Verify that the refined plan aligns with the overall project goals, current status (as potentially documented in `status.md` or `work-in-progress.md`), and any relevant GitHub issues.
4.  **Handle Large File Edits Strategically**: If the task list file is very large and direct replacement of the entire content via `replace_file_content` (with full `TargetContent`) fails due to timeouts or size limits:
    *   **Incremental Edits**: Use `replace_file_content` with multiple, smaller `ReplacementChunks` targeting specific sections of the file. This requires careful identification of unique `TargetContent` for each chunk.
    *   **Section-by-Section Replacement**: If the file can be logically divided, update it section by section across multiple tool calls, ensuring each `TargetContent` is precise.
    *   **Create New Version**: As a last resort, if incremental edits are too complex or prone to error, consider creating a new, cleaned-up version of the file (e.g., `TASK_LIST_V2.md`) using `write_to_file` with the new content, and then (manually or via a separate step) archiving or deleting the old file. Document this change clearly.

By following this workflow, the task list will become a more streamlined and effective document for guiding and tracking development efforts.
