# Quilt: Scientific Data Management on AWS

[![Docs](https://img.shields.io/badge/Docs-docs.quilt.bio-0B5FFF?style=for-the-badge)](https://docs.quilt.bio/)
[![Join Office Hours](https://img.shields.io/badge/Join%20Office%20Hours-Live%20Friday-00875A?style=for-the-badge)](https://riverside.com/webinar/registration/eyJzbHVnIjoic2ltb24ta29obnN0YW1tcy1zdHVkaW8iLCJldmVudElkIjoiNjk5Y2M5MDI4YjVkM2Y2MjFjYTk5MzgzIiwicHJvamVjdElkIjoiNjk5Y2M5MDI1OTE5NDU0YmNlOWEzZDVmIn0=)
[![Book an Intro](https://img.shields.io/badge/Book%20an%20Intro-Meet%20the%20Team-5E4AE3?style=for-the-badge)](https://www.quilt.bio/meetings/simon-kohnstamm/quilt-introduction)

Quilt is a **Scientific Data Management Platform on AWS** that helps teams and
AI find, trust, and reuse data through deeply versioned, context-rich data
packages.

Most scientific organizations do not struggle to generate data. They struggle
to keep it usable over time. As teams, tools, and workflows evolve, context
gets lost, scientists cannot find what they need, data teams get pulled into
manual support, and AI projects slow down because data lacks structure,
lineage, and trust.

Quilt solves this by turning cloud data into durable, searchable, reusable
packages. Each package captures data plus metadata, documentation, lineage, and
version history needed for confident reuse. Built on AWS, Quilt works with data
in place, so organizations can improve data management without disruptive
migrations or rigid workflows.

## Open Source and Enterprise

Quilt includes both open-source software and an enterprise platform deployment model.

- **Open source (this repository):**
  - Python SDK and CLI for creating Quilt packages, installing packages
    locally, and uploading packages to S3 using your AWS credentials
  - Package versioning, reproducibility, and documentation workflows that fit
    data science and bioinformatics workloads
  - Does **not** provide the full hosted search and visualization experience
    for package discovery and collaboration
- **Enterprise platform:**
  - Dedicated AWS-hosted Quilt platform for teams to search, share, and
    visualize Quilt packages
  - Multi-user collaboration and governance features on top of open-source
    package workflows

Start with:

- Open-source docs: [`docs/README.md`](docs/README.md)
- Enterprise administration docs: [`docs/technical-reference.md`](docs/technical-reference.md)
- Contributor guide: [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md)

## Repository Map

Use this to find where each major part of Quilt lives.

| Path | What it contains |
| --- | --- |
| `api/python` | `quilt3` Python SDK, CLI, and Python tests |
| `catalog` | Quilt web catalog frontend (TypeScript/JavaScript) |
| `lambdas` | AWS Lambda services (indexing, previews, events, etc.) |
| `shared` | Shared schemas and cross-component assets |
| `py-shared` | Shared Python utilities used by services |
| `s3-proxy` | S3 proxy service components |
| `docs` | Product, platform, API, and contributor documentation |
| `gendocs` | API documentation generation tooling |
| `testdocs` | Documentation codeblock validation tools |

## Quick Start for Contributors

1. Fork the repository, clone your fork, and create a branch from `upstream/master`:

   ```bash
  git clone https://github.com/<your-github-user>/quilt
  cd quilt
  git remote add upstream https://github.com/quiltdata/quilt
  git fetch upstream
  git checkout -b my-change upstream/master
   ```

  Push your branch to your fork and open a pull request from there:

  ```bash
  git push -u origin my-change
  ```

2. Install Python task runner:

   ```bash
   # macOS/Linux
   curl -LsSf https://astral.sh/uv/install.sh | sh
   ```

3. Run Python tests:

   ```bash
   cd api/python
   uv run poe test
   ```

4. Run catalog locally:

   ```bash
   cd catalog
   npm install
   npm start
   ```

For full setup, testing, and release steps, see [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md).

## Learn More

- Product docs: [docs.quilt.bio](https://docs.quilt.bio/)
- Open data demo catalog: [open.quiltdata.com](https://open.quiltdata.com/)
- Case studies and customer stories: [quilt.bio/case-studies](https://www.quilt.bio/case-studies)
- Slack community: [Join Quilt Slack][quilt-slack]

[quilt-slack]: https://slack.quilt.bio
