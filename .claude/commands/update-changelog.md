---
description: Update CHANGELOG.md following Keep a Changelog format and semantic versioning rules
allowed-tools: Bash(git describe:*), Bash(git log:*), Bash(git diff:*), Read, Edit, mcp__pieces__ask_pieces_ltm, mcp__pieces__create_pieces_memory
---

# Update Changelog

This command analyzes git history since the last release and updates the CHANGELOG.md file following the project's established format and conventions.

**IMPORTANT**: The CHANGELOG.md file MUST be updated before any release can be created. This is a mandatory step in the release process to ensure proper documentation of changes and maintain transparency with users about what has been modified, added, or fixed in each version.

## Workflow

### 1. Analyze Current State

First, I'll identify the latest release and analyze changes:

```bash
# Get the latest release tag
git describe --tags --abbrev=0

# Check if current HEAD has a matching tag (version already released)
git tag --points-at HEAD

# Get commits since last release
git log $(git describe --tags --abbrev=0)..HEAD --oneline --no-merges

# Get overall statistics
git diff $(git describe --tags --abbrev=0)..HEAD --stat
```

**Release Status Detection**:

- If HEAD has a tag: Version is already released, no changelog update needed
- If no tag on HEAD but commits exist since last tag: Working on unreleased version
- Check existing changelog for unreleased version section to refine rather than create new

### 2. Categorize Changes

I'll analyze commits and categorize them according to the established categories:

- **Features**: New functionality, components, services, zomes, user-facing capabilities
- **Refactor**: Code restructuring, performance improvements, code organization
- **Fixed**: Bug fixes, error handling improvements, UI/UX fixes
- **Testing**: New tests, test improvements, testing infrastructure
- **Documentation**: Documentation updates, README changes, comments
- **Dependencies**: Package updates, new/removed dependencies
- **Maintenance**: Build system, CI/CD, development tooling changes

### 3. Format Entries

Each entry will follow the established format:

```markdown
- Brief description of the change (relates to #issue-number) (`commit-hash`).
```

Guidelines:

- Present tense ("Add feature" not "Added feature")
- Concise but descriptive
- Include issue numbers when applicable
- Include 7-character commit hash
- Group related commits into single entries

### 4. Determine Release Status & Version Strategy

**A. Check Release Status**:

```bash
# If HEAD has a tag, version is already released
if git tag --points-at HEAD; then
    echo "Current commit is already tagged - no changelog update needed"
    exit 0
fi
```

**B. Version Number Strategy**:

- **If unreleased version exists in changelog**: Refine existing section, update date to today
- **If no unreleased version**: Determine next version based on semantic versioning rules:
  - **Major (X.0.0)**: Breaking changes, incompatible API changes
  - **Minor (0.X.0)**: New features, backwards compatible
  - **Patch (0.0.X)**: Bug fixes, backwards compatible

For pre-release versions:

- **Alpha**: Early development, unstable features
- **Beta**: Feature complete, testing phase
- **RC**: Release candidate, final testing

### 5. Update CHANGELOG.md Strategy

**A. For Unreleased Versions**:

- Locate existing unreleased version section in CHANGELOG.md
- Update/refine entries with new commits since last update
- Update date to current date
- Merge and organize entries by category

**B. For New Versions**:

- Insert new version section at the top of CHANGELOG.md with proper formatting and categorization
- Ensure all changes since the last release are properly documented in the CHANGELOG.md file

## Implementation

I'll execute this workflow systematically to ensure the CHANGELOG.md file is properly updated:

1. **Release Status Check**: Verify if current HEAD is already tagged (released)
2. **Git Analysis**: Run git commands to gather commit and diff data since last release
3. **CHANGELOG.md Analysis**: Check if unreleased version section already exists
4. **Change Classification**: Parse commits using conventional commit patterns and keywords
5. **Entry Generation**: Create properly formatted changelog entries with commit hashes
6. **Version Strategy**: Either refine existing unreleased section or create new version
7. **CHANGELOG.md Update**: Update existing section or insert new section with proper formatting in the CHANGELOG.md file
8. **Quality Validation**: Check against the established quality checklist to ensure CHANGELOG.md is complete and accurate

**Decision Logic**:

- **Already Released** (HEAD has tag): Inform user, no action needed
- **Unreleased Version Exists**: Refine existing section with new commits, update date
- **No Unreleased Version**: Create new version section based on semantic versioning

## Quality Checklist

Before finalizing the CHANGELOG.md file:

- [ ] Release status correctly identified (released vs unreleased)
- [ ] All significant commits since last release are included in CHANGELOG.md
- [ ] Entries are categorized correctly according to the established format
- [ ] Commit hashes are accurate (7 characters)
- [ ] Issue numbers are referenced where applicable
- [ ] Breaking changes are clearly marked
- [ ] Version number follows semantic versioning (or refined existing unreleased version)
- [ ] Date is accurate (current date for unreleased versions)
- [ ] Grammar and spelling are correct
- [ ] Related commits are grouped logically
- [ ] No duplicate entries when refining existing sections
- [ ] **MANDATORY**: CHANGELOG.md file has been updated and contains all changes for the upcoming release
- [ ] **MANDATORY**: CHANGELOG.md follows the Keep a Changelog format exactly as specified
- [ ] **MANDATORY**: All changes are properly documented before any release is created

## Command Integration

This command integrates with the project's documentation maintenance workflow and follows the established patterns in `documentation/ai/rules/changelog-maintenance.md`.

## Release Process Requirement

**CRITICAL**: The CHANGELOG.md file MUST be updated before creating any release. This command ensures that:

1. **Transparency**: Users can see exactly what changed in each version
2. **Traceability**: All changes are documented with commit hashes for reference
3. **Compliance**: The project follows industry-standard changelog practices
4. **Quality**: Release process includes proper documentation as a quality gate

**Remember**: A release cannot be created without first updating the CHANGELOG.md file with all the changes included in that release. This is a non-negotiable step in the release workflow.
