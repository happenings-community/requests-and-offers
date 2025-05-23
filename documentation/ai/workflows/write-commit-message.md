---
description: How to write a meaningful git commit message
---

# Git Commit Message Workflow

This workflow helps create standardized, meaningful git commit message suggestions by analyzing staged changes and relevant GitHub issues. The AI will only suggest a message format - it will NOT execute any commits. Don't ask questions, just suggest a commit message.

## Steps

1. First, examine the staged changes in detail:

   ```bash
   git diff --staged
   ```

2. If the diff output is too large or appears truncated:

   - Focus on analyzing the visible portions first
   - Use more targeted approaches to examine specific files:

   ```bash
   git diff --staged --name-only  # List all staged files
   git diff --staged <file_path>  # Examine specific important files
   git diff --staged --stat       # Get a statistical overview of changes
   ```

   This helps prioritize which diffs to review in detail if there are many changes.

3. Review the diffs of staged files to understand the changes:

   - If there are few files, review each one:

     ```bash
     git diff --staged <file_path>
     ```

   - If there are many files, prioritize reviewing the ones identified as having the biggest changes. In some cases, a full `git diff --staged` might still be useful, but be mindful of potentially large outputs that could be truncated or overwhelming.

4. Check if the commit is related to a GitHub issue:

   - Look for issue numbers in branch names (e.g., `feature/123-add-new-component`)
   - Look for issue references in the code comments (e.g., `// Fixes #123`)
   - Look for issue reference in the task-list that is potentially updated with the commit.
   - If found, fetch the issue details using the GitHub MCP.

5. Craft a commit message following this structure:

   ```text
   <type>(<scope>): <short summary>

   <detailed body explanation with implementation details and impact>

   [optional footer with "Fixes #123" or "Related to #123"]
   ```

   Where:

   - **type**: feat (feature), fix, docs, style, refactor, test, chore, etc.
   - **scope**: component or area of the codebase (optional)
   - **summary**: concise description in present tense, not capitalized, no period
   - **body**: REQUIRED detailed explanation that addresses:
     - WHAT was changed (implementation details)
     - HOW it affects the system (impact and dependencies)
     - Any trade-offs or considerations made
   - **footer**: reference to issues, breaking changes, etc.

6. Examples of good commit messages:

   ```text
   feat(search): add brave search api integration

   This change implements a new search provider using the Brave Search API.
   The integration allows users to perform private, untracked web searches
   directly from our application without relying on Google's services.

   The implementation includes:
   - A new BraveSearchClient class with rate limiting and error handling
   - Updated SearchProvider interface to support the new provider
   - Configuration options for API keys and regional settings
   - Unit and integration tests for the new client

   The implementation provides a more ethical search alternative with improved privacy.

   Fixes #42
   ```

   ```text
   fix(data-layer): resolve profile database connection issue

   This fix addresses a critical race condition that occurs when multiple
   profile databases are opened simultaneously. The issue was causing
   intermittent data corruption and application crashes for users with
   multiple profiles.

   Technical changes:
   - Added mutex locks around database connection initialization
   - Implemented connection pooling to reuse existing connections
   - Added retry logic with exponential backoff for failed connections
   - Improved error reporting to help diagnose similar issues

   Performance impact is minimal (<5ms per operation) but significantly
   improves stability for multi-profile users. This was extensively tested
   with 100+ simultaneous connections without failures.

   Related to #123
   ```

**IMPORTANT**: The AI will NEVER execute the commit command automatically.

## Tips

- Keep the summary line under 50 characters if possible
- Wrap body text at 72 characters
- Use imperative mood ("add" not "added" or "adds")
- Make the body message detailed and comprehensive:
  - Describe the key technical changes (WHAT)
  - Outline the impact and any trade-offs (HOW it affects the system)
  - Include relevant metrics or test results when applicable
  - Use bullet points for clarity when listing multiple changes
  - Ensure all changes in the `git diff --staged` are addressed in the commit message body.
- Structure the body with paragraphs for different aspects (implementation, impact)
- Reference relevant issues in the footer
- Consider including links to relevant documentation or discussions
