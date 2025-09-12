<!-- markdownlint-disable MD013 -->
# I RASP DECO Methodology Implementation Guide

**Foundation**: Implements [Accountability-Driven Development (ADD)](https://ihack.us/2025/08/22/add-the-beat-accountability-driven-development-in-an-ai-world/) principles through the I RASP DECO structured development process.

**Universal Patterns**: See [AGENTS.md](./AGENTS.md) for core AI collaboration principles that underlie this methodology.

**Complete Specification**: See [spec/112/03-specifications.md](./112/03-specifications.md) for detailed I RASP DECO methodology specification.

**Examples**: See `./spec/100/*.md` for real-world examples of each document

## I RASP DECO Process Overview

**I RASP Phase (Analysis)**:

1. **I**ssue - Presenting problem identification and GitHub issue tracking
2. **R**equirements - User-centered stories and UAT acceptance criteria  
3. **A**nalysis - Current code idiom/architecture and challenges assessment
4. **S**pecifications - Desired end state goals (NO implementation details)
5. **P**hases - Incremental PRs breakdown for sequential implementation

**DECO Phase (Implementation)**:

1. **D**esign - Specific work to be done for each phase
2. **E**pisodes - Atomic change units to test and push  
3. **C**hecklist - Detailed instructions to ensure compliance
4. **O**rchestrator - Use dedicated Agents to ensure checklist is followed

## Document Structure Pattern

**Sequential numbering for chronological phases**:

- `01-requirements.md` - User-centered stories and acceptance criteria
- `02-analysis.md` - Current code idiom/architecture and challenges
- `03-specifications.md` - Desired end state and engineering constraints
- `04-phases.md` - Incremental PRs breakdown for implementation
- `{x}-phase{N}-design.md` - Phase N specific work design (x = 4+2N)
- `{x+1}-phase{N}-episodes.md` - Phase N atomic change units
- `{x+2}-phase{N}-checklist.md` - Phase N validation and tracking
- `{M}-review.md` - Implementation review and lessons learned

## Initiate I RASP DECO Workflow

### Step 0: Create GitHub Issue

#### 🤖 Issue Prompt (to Agent)

**AI Agent**: Create GitHub issue for problem identification

- Document problem scope and business impact
- Identify stakeholders and affected systems
- Establish tracking number for I RASP DECO process
- Link to any related issues or PRs

#### 👤 Issue Review (by Human)

**Human Review**: Validate issue scope and priority

- Confirm problem statement accuracy
- Approve priority and milestone assignment
- Authorize I RASP DECO process initiation
- **Branch**: Use GitHub to create `YYYY-MM-DD-short-name` for I RASP phase
- Open in Editor / Agenta (typically VS Code + Claude Code)

---

### Step 1: Requirements Analysis

#### 🤖 Requirements Prompt (to Agent)

> Create `spec/{branch_name}/01-requirements.md` using a Business Analyst or Product Owner agent, following the Requirements Instructions in Step 1 of @spec/WORKFLOW.md

#### 📝 Requirements Instructions (for Agent)

Using the GitHub issue from Step 0, create requirements document following I RASP DECO methodology:

- Reference the GitHub issue number and problem statement
- Expand the issue description into detailed user stories: "As a [role], I want [functionality] so that [benefit]"
- Convert issue scope into numbered acceptance criteria
- Build on issue context for high-level implementation approach (no technical details)
- Define measurable success criteria based on issue impact
- Identify "Open Questions" for relevant information you cannot infer

Format as markdown with clear sections and numbered lists. Fix IDE Diagnostics.

#### 👤 Requirements Review (by Human)

Validate problem understanding and acceptance criteria

- Address Open Questions
- Verify user stories capture actual needs
- Confirm acceptance criteria are measurable
- Approve, edit or request revisions before initiating next step

---

### Step 2: Analysis

#### 🤖 Analysis Prompt (to Agent)

> Create `spec/{branch_name}/02-analysis.md` using a research analyst or architecture agent, following the Analysis Instructions in Step 2 of @spec/WORKFLOW.md

#### 📝 Analysis Instructions (for Agent)

Using the requirements document from Step 1, create an analysis document that:

- Reference the user stories and acceptance criteria from 01-requirements.md
- Analyze current codebase architecture and implementation patterns
- Identify existing code idioms and conventions that should be followed
- Document current system constraints and limitations
- Assess technical debt and refactoring opportunities
- Identify gaps between current state and requirements
- Document architectural challenges and design considerations
- Do NOT propose solutions or implementation approaches yet

Focus on "what exists now" and "what are the challenges".
Format as markdown with clear sections and numbered lists.

#### 👤 Analysis Review (by Human)

Validate current state assessment and challenge identification

- Confirm accuracy of current system analysis
- Verify architectural constraints are properly identified
- Approve challenge assessment before proceeding
- Approve, edit or request revisions before initiating next step

---

### Step 3: Engineering Specifications

#### 🤖 Specification Prompt (to Agent)

> Create `spec/{branch_name}/03-specifications.md` using an appropriate architecture or developer agent, following the Specification Instructions in Step 3 of @spec/WORKFLOW.md

#### 📝 Specification Instructions (for Agent)

Using the requirements and analysis documents from Steps 1-2, create a specifications document that:

- Reference the acceptance criteria from 01-requirements.md
- Build upon the current state analysis from 02-analysis.md
- Write high-level specs describing the desired end state (NO Implementation details)
- Define success criteria and measurable outcomes
- Specify architectural goals and design principles
- Define integration points and API contracts
- Establish quality gates and validation criteria
- Do NOT write implementation details or code samples (at most: signatures)
- Identify technical (architectural, algorithmic, dependency) uncertainties and risks

EXCLUDE: Implementation code, detailed procedures.
Format as markdown with clear sections and numbered lists.

#### 👤 Specification Review (by Human)

Confirm engineering approach and success metrics

- Validate technical feasibility
- Approve phase breakdown strategy
- Confirm success metrics are appropriate
- Approve, edit or request revisions before initiating next step

---

### Step 4: Implementation Phases Breakdown

#### 🤖 Phases Prompt (to Agent)

> Create `spec/{branch_name}/04-phases.md` using a project manager or workflow orchestrator agent, following the Phases Instructions in Step 4 of @spec/WORKFLOW.md

#### 📝 Phases Instructions (for Agent)

Using the specifications document from Step 3, create a phases breakdown document that:

- Reference the desired end state from 03-specifications.md
- Build upon the gap analysis from 02-analysis.md
- Break implementation down into incremental PRs that can be sequentially reviewed and merged
- Define clear deliverables and success criteria for each phase
- Identify dependencies and sequencing requirements between phases
- Ensure each phase delivers working, testable functionality
- Plan "pre-factoring" opportunities: make the change easy, then make the easy change
- Define integration testing strategy across phases

Focus on "how to get there incrementally" with clear phase boundaries.
Format as markdown with clear sections and numbered lists.

#### 👤 Phases Review (by Human)

Validate implementation strategy and phase breakdown

- Confirm phases are appropriately scoped
- Verify dependencies and sequencing
- Approve incremental delivery strategy
- Approve, edit or request revisions before initiating next step

---

### Step 5: Implementation Phases

For each implementation phase (repeat as needed):

#### Step 5a: Create Design Document

##### 🤖 Design Prompt (to Agent)

> Create `spec/{branch_name}/{n}-phase{k}-design.md` using a developer agent with the relevant skills, following the Design Instructions in Step 5a of @spec/WORKFLOW.md

##### 📝 Design Instructions (for Agent)

Using the specifications and phases documents from Steps 3-4, create phase-specific design document following the I RASP DECO methodology:

- Reference the specific phase from the implementation phases breakdown in 04-phases.md
- Design technical architecture to meet the target state goals for this phase
- Make design decisions that address the constraints and dependencies identified in specifications
- Create implementation strategy that aligns with the success metrics from specifications
- Plan integration points with other phases as outlined in the phase breakdown
- Justify technology choices against the risk assessment and constraints from specifications
- Define specific work to be done in this phase

Focus on "what" and "how" for this specific phase, grounded in specifications.
Format as markdown with clear sections. Fix IDE Diagnostics.

##### 👤 Design Review (by Human)

Approve technical architecture and implementation strategy

- Validate design decisions
- Confirm integration approach
- Approve technology choices
- Commit design document, then create a NEW child branch and PR for implementation

#### Step 5b: Create Episodes Document

##### 🤖 Episodes Prompt (to Agent)

> Create `spec/{branch_name}/{n+1}-phase{k}-episodes.md` using a developer agent, following the Episodes Instructions in Step 5b of @spec/WORKFLOW.md

##### 📝 Episodes Instructions (for Agent)

Using the design document from this phase, create atomic change units following the I RASP DECO methodology:

- Break down the implementation strategy into atomic change units
- Define each episode as a single, testable, committable change
- Ensure episodes can be tested and pushed independently
- Plan TDD cycle for each episode (Red → Green → Refactor)
- Define clear success criteria for each atomic change
- Sequence episodes to maintain working state throughout
- Link episodes to specific design components

Focus on "atomic units of change" that can be independently validated.
Format as markdown with clear episode definitions.

##### 👤 Episodes Review (by Human)

Approve atomic change breakdown and sequencing

- Confirm episodes are appropriately atomic
- Verify sequencing maintains working state
- Approve episode definitions before proceeding

#### Step 5c: Create Checklist Document

##### 🤖 Checklist Prompt (to Agent)

> Create, in order to implement the above design:
>
> 1. a new branch `{branch_name}/phase{k}-tagline`
> 2. a`spec/{branch_name}/{n+2}-phase{k}-checklist.md`  Checklist Document using a project manager agent with the relevant skills, following the Checklist Instructions in Step 5c of @spec/WORKFLOW.md (then commit + push)
> 3. a PR for the new branch against the original branch

##### 📝 Checklist Instructions (for Agent)

Using the design and episodes documents from this phase, create detailed compliance checklist following the I RASP DECO methodology:

- Reference atomic change units from episodes document
- Create granular tasks with [ ] status tracking for each episode
- Define detailed instructions to ensure compliance with design decisions
- Create validation procedures that verify each design component is properly implemented
- Define Behavior-Driven Development (BDD) requirements that validate the architecture and integration points from design
  - Do NOT write any code in this document
  - Do concisely itemize critical test cases for each episode
- Establish quality gates that confirm success metrics from specifications are met
- Link back to original GitHub issue and reference acceptance criteria from requirements
- Provide detailed instructions for orchestrator agent to follow

Use checkbox format for trackable progress.
Format as markdown with task lists. Fix IDE Diagnostics.

##### 👤 Checklist Review (by Human)

Approve checklist and validation procedures

- Confirm tasks and validation steps are comprehensive
- Approve, edit or request revisions before implementation

#### Step 5d: Orchestrate Implementation

##### 🤖 Orchestrator Prompt (to Agent)

> Use dedicated Orchestrator agents to execute the above checklist, following the Orchestrator Instructions in Step 5d of @spec/WORKFLOW.md.

##### 📝 Orchestrator Instructions (for Agent)

Using the design, episodes, and checklist documents for this phase, orchestrate implementation using dedicated agents:

- Use TodoWrite tool for granular progress tracking (unless Agent has another mechanism)
- Use dedicated agents to ensure checklist compliance (see AGENTS.md)
- Write any scratch documents in the `spec/{branch_name}/` folder
- Execute atomic change units from episodes document in sequence
- For each episode:
  - Write failing behavior-driven tests first (using same methodology as existing tests)
  - Test the expected behavior, NOT the implementation details
  - Commit failing tests before beginning implementation
  - Implement minimum code to pass tests
  - Clearly annotate if/when/why you had to modify tests after the fact
  - Refactor while keeping tests green
  - Commit and push episode completion
- After each episode:
  - Run `make test`
  - Run `make lint`
  - Fix IDE diagnostics
  - Update Checklist with episode completion
  - Commit and push
  - Fix PR errors, address/reply to PR comments; repeat if necessary
- When phase implementation appears done:
  - Ensure checklist is a) updated, and b) accurate
  - Check coverage, increase to 85%+
  - Resolve any outdated PR comments
  - Update the PR description to facilitate Review

##### 👤 Implementation Review (by Human)

Code quality, testing, and functionality validation

- Ensure checklist is completed
- Review implementation against design
- Validate test coverage and quality
- Confirm functionality meets requirements
- Merge PR into feature branch

---

### Step 6: Final Integration

#### 🤖 Integration Prompt (to Agent)

> Process coordination and final integration, following the Integration Instructions in Step 6 of @spec/WORKFLOW.md

#### 📝 Integration Instructions (for Agent)

Using all completed phase checklists from Step 5, coordinate final integration:

- Verify all checkboxes are completed across all phase checklists
- Validate that implementation meets all acceptance criteria from 01-requirements.md
- Confirm current state analysis challenges from 02-analysis.md are addressed
- Confirm all success metrics from 03-specifications.md are achieved
- Verify all phases from 04-phases.md are completed
- Test integration points identified in all design documents
- Validate all atomic change units from episodes documents are working
- Prepare release documentation referencing original GitHub issue resolution

#### 👤 Integration Review (by Human)

Final approval and release authorization

- Complete system validation
- Approve for production deployment
- Document lessons learned
- **All quality gates must pass** before release

---

## Appendix

### Specialized Agent Usage

**business-analyst**: Requirements gathering, user story creation, acceptance criteria (Step 1)

**research-analyst**: Current state analysis, architecture assessment, challenge identification (Step 2)

**cloud-architect/python-pro**: Engineering specifications, desired end state design (Step 3)

**project-manager**: Phases breakdown, implementation strategy, sequencing (Step 4)

**mcp-developer/python-pro**: Phase-specific design, episodes definition (Steps 5a-5b)

**project-manager**: Detailed checklist creation, compliance instructions (Step 5c)

**workflow-orchestrator**: Orchestrate implementation using dedicated agents (Step 5d)

**code-reviewer**: Implementation validation, architecture review, security assessment (All steps)

### Anti-Deception Framework

- Concrete artifacts for review (no "trust me" implementations)
- Atomic change units (one PR per phase/document)
- Branch isolation (specs cannot be modified during implementation)
- Immutable specifications (historical accuracy preserved)

### Tools and Commands

- `make test` - Run all tests including DXT validation
- `make lint` - Code formatting and type checking
- `make coverage` - Test coverage reporting
- `gh` commands - GitHub operations
- `TodoWrite` tool - Progress tracking

### Commit Patterns

- **Spec commits**: "docs: add {phase} documentation for issue #{N}"
- **Episode commits**: "feat: implement {episode} from phase{N} design"  
- **Implementation commits**: Follow BDD cycle with conventional commits
- **Review commits**: "review: complete phase {N} validation"
