# Faraday

Faraday runs a task with Amazon Bedrock and Quilt Platform MCP tools, using a
Quilt package as the durable session. The local CLI and Lambda handler call the
same Python runner.

## Session contract

```text
faraday/<session-name>
├── AGENTS.md              # Entire Bedrock system prompt, reloaded each run
├── README.md              # Session overview
├── session.json           # Format version, status, run IDs, models, usage
├── conversation.jsonl     # Ordered Bedrock messages, including tool results
├── inputs/                # Optional files or Quilt entries referencing source data
└── outputs/               # Artifacts and <run-id>/answer.md for each run
```

Create explicitly with `init`; `run` requires an existing session and never
silently creates one after a failed read. Each completed, failed, or limited run
pushes a new version and returns its exact top hash. Run metadata records the
input package hash, so the prompt and inputs used can be inspected later.
Initialization also pushes a version. Failures before execution (such as invalid
requests, missing packages, or MCP connection failures) leave the session unchanged.

Faraday uses Quilt's normal `Package.browse()` / `Package.push()` serialization
and conflict checks, with no added locking or queue. It never uses `force=True`.
Local changes are uploaded under unique object prefixes so old package versions
remain readable even without bucket versioning. Existing remote package entries
remain references; input data is not eagerly downloaded or copied.

Edit `AGENTS.md` by browsing the session, replacing that entry, and pushing the
updated package. The next run uses that text as its system prompt. Task text,
session file listings, and package metadata are supplied as user context.
The built-in write tool can only write under `outputs/`; it cannot edit the prompt
or conversation. Remote MCP tools execute with the API key owner's permissions.

## Run locally

### Browser runner / viewer

The single-file UI lives in `tests/runner.html`. Start its local Python bridge:

```bash
uv run python tests/serve.py
```

Open **http://127.0.0.1:8787**. The bucket defaults to **s3://protology** and is
editable. Load a session by package name, find saved `faraday/` packages, or create
one with an initial `AGENTS.md`. Run tasks and inspect conversation/tool results,
instructions, run history, and text outputs. File previews use the loaded version's
exact hash so they stay consistent if the package advances in the meantime.

The page has all its CSS and JavaScript inline and no external dependencies.
The bridge serves it and calls the existing Python runner with your shell's AWS
and MCP configuration. No credentials are sent to the browser. It binds only to
localhost and rejects cross-origin API calls. Nothing invokes Bedrock or writes
to the bucket until you choose Create package or Run task. Opening the HTML as a
local file shows the server startup instructions. Use `--port` to change the port.

Runs execute synchronously in the HTTP request. Keep the page and Python server
open during a run; the UI shows elapsed time and reloads the saved session after
completion. Reloading the page does not cancel the server's running task.

### Command line

From this directory, install Python 3.13 dependencies with `uv sync`.
Use normal AWS credentials (`AWS_PROFILE` locally or an execution role in Lambda)
for S3 session storage and Bedrock. Set `AWS_DEFAULT_REGION` to your stack region.

Create a local instructions file:

```markdown
# Faraday

You review scientific data packages. Cite source files, distinguish evidence
from inference, and write reports under outputs/. Use session_read to inspect
session inputs and session_write to save reports. Do not modify source packages.
```

Then create and continue a session:

```bash
uv run python -m t4_lambda_faraday init \
  --registry s3://my-session-bucket --session faraday/metadata-review \
  --agents ./AGENTS.md

uv run python -m t4_lambda_faraday run \
  --registry s3://my-session-bucket --session faraday/metadata-review \
  --task 'Review the files under inputs/ and write a metadata report.'

uv run python -m t4_lambda_faraday run \
  --registry s3://my-session-bucket --session faraday/metadata-review \
  --task 'Summarize the findings from the previous report.'
```

The CLI writes one JSON result to stdout and Quilt progress to stderr. Exit code
is zero for `ready` or `completed`, and nonzero for incomplete/failed/limited runs.
Without MCP configuration, Faraday still has `session_read` and `session_write`.
These operate on UTF-8 files, up to 512 KiB each.

To add existing source data without copying it:

```python
import quilt3

session = quilt3.Package.browse("faraday/metadata-review", registry="s3://my-session-bucket")
source = quilt3.Package.browse("studies/example", registry="s3://research-data")
session.set("inputs/README.md", source["README.md"])
session.push(
    "faraday/metadata-review",
    registry="s3://my-session-bucket",
    selector_fn=quilt3.Package.selector_fn_copy_local,
)
```

## Platform MCP and configuration

Set `FARADAY_MCP_URL` to your stack's HTTPS Platform MCP endpoint, such as
`https://<connect-host>/mcp/platform/mcp`, and inject `QUILT_API_KEY` through your
normal secret-management setup. The key is used only as an HTTP bearer credential;
Faraday does not put it in prompts, session configuration, or logs. See the
[headless MCP authentication documentation](../../docs/Catalog/MCP-Server.md#headless-access-with-api-keys).

MCP tool discovery is paginated, with transport/session negotiation handled by
the official Python MCP SDK. Text, structured results, and supported image blocks
are mapped into Bedrock tool results. Other content blocks are passed as JSON.
The prototype does not implement Catalog's browser navigation or native document
preview tools. Available platform tools depend on the configured server.

| Environment variable | Default / purpose |
| --- | --- |
| `FARADAY_MODEL_ID` | `us.anthropic.claude-sonnet-4-5-20250929-v1:0` |
| `FARADAY_MCP_URL` | Optional HTTPS MCP endpoint |
| `QUILT_API_KEY` | Required when MCP is configured; tool identity only |
| `FARADAY_MAX_TURNS` | `12` model calls per invocation |
| `FARADAY_MAX_SECONDS` | `240` execution budget |
| `FARADAY_MAX_TOKENS` | `4096` output tokens per model call |

The session S3 credentials and MCP identity are separate: session reads/writes
use the AWS credential chain; platform operations use the API key owner's role.
Instructions in `AGENTS.md` guide model behavior; AWS and Quilt permissions enforce
access. Configure the Lambda caller and execution-role permissions accordingly.

## Lambda

Handler: `t4_lambda_faraday.lambda_handler`, Python 3.13. The prototype adds Faraday
to the existing Python CI and Lambda zip artifact matrices; it does not create or
deploy an AWS function. Deployment infrastructure belongs in the deployment project.

Invoke with the same contract used by the CLI:

```json
{
  "action": "init",
  "session": {"registry": "s3://my-session-bucket", "package": "faraday/metadata-review"},
  "agents": "You review scientific packages. Cite evidence and write reports under outputs/."
}
```

```json
{
  "session": {"registry": "s3://my-session-bucket", "package": "faraday/metadata-review"},
  "task": "Review the session inputs and write a report."
}
```

Provision S3 read/write access to the session registry and read access to any
referenced inputs, Bedrock model/inference-profile invocation access, any necessary
KMS permissions, and outbound connectivity to Bedrock, S3, and MCP. Use a function
timeout with room for package loading and saving beyond the task execution budget.

## Prototype limits

- State is saved at the end of each invocation. A hard process termination can
  lose that invocation's work; external tool side effects may already have happened.
  There is no retry deduplication or automatic retry of side-effecting tools.
- The time budget is checked between operations. MCP calls have timeouts and
  Bedrock has bounded connect/read timeouts with SDK retries disabled. Synchronous
  S3/Bedrock operations can run beyond the nominal budget. Lambda reserves 30
  seconds when computing the budget, but this is not a hard checkpoint guarantee.
- History has an 8 MiB storage ceiling and a 4 MiB pre-inference budget; these are
  byte limits, not model token limits. No automatic summarization is implemented.
- Native image tool results are stored as base64 in history and restored to bytes
  for Bedrock. Large tool results are returned to the model as errors.
- Session versions are ordinary Quilt packages, inspectable through the Catalog.
  Concurrent writers use the SDK's existing conflict behavior.

## Development checks

```bash
uv run pytest --cov=src --cov-report=term-missing
uv run ruff check src tests
uv run ruff format --check src tests
uv build
uv run --no-editable pytest --collect-only -q
```

Tests exercise real Quilt serialization against Moto S3, Bedrock request validation
with Botocore, and the official MCP client's HTTP handshake, pagination, SSE, and
tool result handling against a mock HTTP transport. They make no live model calls.
The Quilt dependency is pinned to the repository revision used for this prototype
because it includes the SDK's package conflict behavior; update that pin deliberately.
