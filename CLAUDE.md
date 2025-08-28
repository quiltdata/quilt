# Development Guidelines for Claude

## Core Philosophy

### Spec-Driven Development

**For complex features, follow [WORKFLOW.md](./WORKFLOW.md)** which defines:

- Specification creation in `./spec/` folder
- Branch strategy: `spec/<feature>` → `impl/<feature>`
- BDD test requirements
- Integration test specifications

**TEST-DRIVEN DEVELOPMENT IS NON-NEGOTIABLE.** Every single line of production code must be written in response to a failing test. No exceptions. This is not a suggestion or a preference - it is the fundamental practice that enables all other principles in this document.

I follow Test-Driven Development (TDD) with a strong emphasis on behavior-driven testing and functional programming principles. All work should be done in small, incremental changes that maintain a working state throughout development.

## Quick Reference

**Key Principles:**

- Write tests first (TDD)
- Test behavior, not implementation
- Small, pure functions
- Use real schemas/types in tests, never redefine them

**Preferred Tools:**

- **Language**: Python
- **State Management**: Prefer immutable patterns

## Testing Principles

### Behavior-Driven Testing

- **No "unit tests"** - this term is not helpful. Tests should verify expected behavior, treating implementation as a black box
- Test through the public API exclusively - internals should be invisible to tests
- No 1:1 mapping between test files and implementation files
- Tests that examine internal implementation details are wasteful and should be avoided
- **Coverage targets**: 100% coverage should be expected at all times, but these tests must ALWAYS be based on business behaviour, not implementation details
- Tests must document expected business behaviour

### Test Data Pattern

Use factory functions with optional overrides for test data:

- Single-parameter pure functions
- Well-established functional patterns (map, filter, reduce callbacks)
- Mathematical operations where order is conventional

## Development Workflow

### Prefactoring - Feature-Level Preparation

Before implementing any feature, follow this structured approach to ensure solid foundations:

#### 1. Test - Expand the Safety Net

**Objective**: Strengthen test coverage so every future change has clear signals of correctness.

- **Audit existing tests** around the feature area - identify gaps in behavior coverage
- **Add missing behavioral tests** for edge cases and integration points
- **Ensure test quality** - tests should verify business behavior, not implementation details
- **Validate test reliability** - tests should fail when they should, pass when they should

#### 2. Refactor - Prepare the Foundation

**Objective**: Simplify and restructure existing code to make space for new functionality.

- **Eliminate technical debt** in the area where new feature will be added
- **Extract reusable components** that the new feature will need
- **Simplify complex conditional logic** that might interact with new feature
- **Improve naming and structure** to clearly express current intent
- **Remove dead code** and unused abstractions that might confuse implementation

#### 3. Implement - Build on Solid Ground

**Objective**: Deliver the feature predictably once foundations are solid.

- **Follow TDD micro-cycles** (Red → Green → Refactor) within this phase
- **Build incrementally** with each change maintaining working state
- **Focus on clarity** over cleverness in implementation
- **Verify all safety net tests still pass** throughout implementation

#### Why Prefactoring Matters

- **Reduces implementation risk** by addressing complexity before adding more
- **Creates predictable development** instead of heroic debugging sessions
- **Establishes trust in AI-assisted development** through systematic approach
- **Prevents compounding technical debt** by cleaning before building
- **Enables confident changes** with comprehensive test coverage

**Remember**: Prefactoring operates at the feature level, while TDD operates at the implementation level. Both are essential for maintainable code evolution.

### TDD Process - THE FUNDAMENTAL PRACTICE

**CRITICAL**: TDD is not optional. Every feature, every bug fix, every change MUST follow this process:

Follow Red-Green-Refactor strictly:

1. **Red**: Write a failing test for the desired behavior. NO PRODUCTION CODE until you have a failing test.
   - Commit: `"test: Add BDD tests for <feature-name>"`
   - Verify tests fail: `"test: Verify BDD tests fail without implementation"`

2. **Green**: Write the MINIMUM code to make the test pass. Resist the urge to write more than needed.
   - Initial: `"feat: Initial implementation (red phase)"`
   - Complete: `"feat: Complete implementation (green phase)"`

3. **Refactor**: Assess the code for improvement opportunities. If refactoring would add value, clean up the code while keeping tests green.
   - Commit: `"refactor: Clean up implementation"`
   - Coverage: `"test: Achieve 100% BDD coverage"`

**Common TDD Violations to Avoid:**

- Writing production code without a failing test first
- Writing multiple tests before making the first one pass
- Writing more production code than needed to pass the current test
- Skipping the refactor assessment step when code could be improved
- Adding functionality "while you're there" without a test driving it

**Remember**: If you're typing production code and there isn't a failing test demanding that code, you're not doing TDD.

### Refactoring - The Critical Third Step

Evaluating refactoring opportunities is not optional - it's the third step in the TDD cycle. After achieving a green state and committing your work, you MUST assess whether the code can be improved. However, only refactor if there's clear value - if the code is already clean and expresses intent well, move on to the next test.

#### What is Refactoring?

Refactoring means changing the internal structure of code without changing its external behavior. The public API remains unchanged, all tests continue to pass, but the code becomes cleaner, more maintainable, or more efficient. Remember: only refactor when it genuinely improves the code - not all code needs refactoring.

#### When to Refactor

- **Always assess after green**: Once tests pass, before moving to the next test, evaluate if refactoring would add value
- **When you see duplication**: But understand what duplication really means (see DRY below)
- **When names could be clearer**: Variable names, function names, or type names that don't clearly express intent
- **When structure could be simpler**: Complex conditional logic, deeply nested code, or long functions
- **When patterns emerge**: After implementing several similar features, useful abstractions may become apparent

**Remember**: Not all code needs refactoring. If the code is already clean, expressive, and well-structured, commit and move on. Refactoring should improve the code - don't change things just for the sake of change.

#### Refactoring Guidelines

##### 1. Commit Before Refactoring

Always commit your working code before starting any refactoring. This gives you a safe point to return to:

```bash
git add .
git commit -m "feat: add payment validation"
# Now safe to refactor
```

##### 2. Look for Useful Abstractions Based on Semantic Meaning

Create abstractions only when code shares the same semantic meaning and purpose. Don't abstract based on structural similarity alone - **duplicate code is far cheaper than the wrong abstraction**.

**Questions to ask before abstracting:**

- Do these code blocks represent the same concept or different concepts that happen to look similar?
- If the business rules for one change, should the others change too?
- Would a developer reading this abstraction understand why these things are grouped together?
- Am I abstracting based on what the code IS (structure) or what it MEANS (semantics)?

**Remember**: It's much easier to create an abstraction later when the semantic relationship becomes clear than to undo a bad abstraction that couples unrelated concepts.

##### 3. Understanding DRY - It's About Knowledge, Not Code

DRY (Don't Repeat Yourself) is about not duplicating **knowledge** in the system, not about eliminating all code that looks similar.

##### 4. Maintain External APIs During Refactoring

Refactoring must never break existing consumers of your code.

##### 5. Verify and Commit After Refactoring

**CRITICAL**: After every refactoring:

1. Run all tests - they must pass without modification
2. Run static analysis (linting, type checking) - must pass
3. Commit the refactoring separately from feature changes

#### Refactoring Checklist

Before considering refactoring complete, verify:

- [ ] The refactoring actually improves the code (if not, don't refactor)
- [ ] All tests still pass without modification
- [ ] All static analysis tools pass (linting, type checking)
- [ ] No new public APIs were added (only internal ones)
- [ ] Code is more readable than before
- [ ] Any duplication removed was duplication of knowledge, not just code
- [ ] No speculative abstractions were created
- [ ] The refactoring is committed separately from feature changes

### Commit Guidelines

- Each commit should represent a complete, working change
- Use conventional commits format:

  ```text
  feat: add payment validation
  fix: correct date formatting in payment processor
  refactor: extract payment validation logic
  test: add edge cases for payment validation
  ```

- Include test changes with feature changes in the same commit

### Pull Request Standards

- Every PR must have all tests passing
- Code must have 100% coverage
- All linting and quality checks must pass
- Work in small increments that maintain a working state
- PRs should be focused on a single feature or fix
- Include description of the behavior change, not implementation details

## Working with Claude

### Expectations

When working with my code:

1. **ALWAYS FOLLOW TDD** - No production code without a failing test. This is not negotiable.
2. **Use Prefactoring for features** - Before implementing, strengthen tests and clean existing code (see Prefactoring section above)
3. **Use TodoWrite tool** - Track progress through workflow steps, especially for complex tasks (see [WORKFLOW.md](./WORKFLOW.md))
4. **Think deeply** before making any edits
5. **Understand the full context** of the code and requirements
6. **Ask clarifying questions** when requirements are ambiguous
7. **Think from first principles** - don't make assumptions
8. **Assess refactoring after every green** - Look for opportunities to improve code structure, but only refactor if it adds value
9. **Keep project docs current** - update them whenever you introduce meaningful changes
   **At the end of every change, update CLAUDE.md with anything useful you wished you'd known at the start**.
   This is CRITICAL - Claude should capture learnings, gotchas, patterns discovered, or any context that would have made the task easier if known upfront. This continuous documentation ensures future work benefits from accumulated knowledge

### Code Changes

When suggesting or making changes:

- **Start with a failing test** - always. No exceptions.
- After making tests pass, always assess refactoring opportunities (but only refactor if it adds value)
- After refactoring, verify all tests and static analysis pass, then commit
- Respect the existing patterns and conventions
- Maintain test coverage for all behavior changes
- Keep changes small and incremental
- Provide rationale for significant design decisions

**If you find yourself writing production code without a failing test, STOP immediately and write the test first.**

### Workflow Execution

**For GitHub issue processing, follow [WORKFLOW.md](./WORKFLOW.md)** which provides:

- 14-step standardized workflow
- Issue analysis and branch creation
- Spec-driven development process
- BDD and integration testing requirements
- PR creation and merge procedures

Key execution guidelines:

- **Always check current branch and git status** before proceeding
- **Run IDE diagnostics check** after each significant change
- **Use `gh` commands for all GitHub operations**
- **Follow conventional commit format** for all commits
- **Ask for clarification** if environment setup scripts don't exist

### Communication

- Be explicit about trade-offs in different approaches
- Explain the reasoning behind significant design decisions
- Flag any deviations from these guidelines with justification
- Suggest improvements that align with these principles
- When unsure, ask for clarification rather than assuming

## Summary

The key is to write clean, testable, functional code that evolves through small, safe increments. Every change should be driven by a test that describes the desired behavior, and the implementation should be the simplest thing that makes that test pass. When in doubt, favor simplicity and readability over cleverness.

## Repository-Specific Commands

For this repository's specific commands and permissions, see this CLAUDE.md file which contains:

- Pre-approved Makefile targets (use those to run tests when possible)
- Phase-specific commands (app, build, catalog, deploy)
- Testing and validation procedures
- AWS operations and deployment commands
- Docker operations
- Environment setup and dependencies

## Important Instruction Reminders

**CRITICAL: Do what has been asked; nothing more, nothing less.**

- If asked to "create a spec", ONLY create the specification document - do NOT implement it
- If asked to "write documentation", ONLY write the documentation - do NOT implement the features described
- If asked to "analyze code", ONLY analyze - do NOT modify or implement changes
- NEVER create files unless they're absolutely necessary for achieving your goal
- ALWAYS prefer editing an existing file to creating a new one
- NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User
- NEVER implement features when only asked to specify or document them

## Permissions

The following permissions are granted for this repository:

- You may run any pre-approved `make` targets as defined in the Makefile.
- You are permitted to use `gh` (GitHub CLI) commands for repository operations, including issue management, PR creation, and branch handling.
- You may execute local scripts located in the repository (e.g., shell scripts, Python scripts) as long as they are referenced in documentation or Makefile targets.
- You are permitted to use `uv` for Python dependency management and installation, provided its usage is documented in the repository or referenced by Makefile targets.

**Note:** Only use these commands/scripts as documented or when required by the workflow. Do not introduce new scripts or commands without explicit approval.

## Testing Gotchas & Patterns

**Dependency Management:**

- Always use `uv sync --group test` to install test dependencies before running tests
- Use `make coverage` for full test runs, but beware matplotlib import conflicts can occur in mixed environments
- For isolated module testing, use `PYTHONPATH=app uv run pytest tests/test_<module>.py -v`

**BDD Test Patterns:**

- Use `tempfile.NamedTemporaryFile()` and `tempfile.TemporaryDirectory()` for file system tests
- Always clean up temp files with try/finally blocks
- Test both success and failure scenarios for file operations
- Mock external dependencies (platform detection, file systems) for reliable cross-platform tests

**WORKFLOW Execution:**

- Check git status and current branch before starting any workflow
- Use TodoWrite tool to track multi-step processes
- Always run IDE diagnostics after implementation
- Push changes before creating PRs to ensure remote branch is up-to-date
- **CRITICAL:** Always create specification document in `./spec/` folder before implementation (we skipped this step in issue #60)
- **Use sub-agents** from `.claude/agents/` for complex workflow phases to prevent context loss
