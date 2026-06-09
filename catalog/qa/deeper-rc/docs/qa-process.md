# RC Deeper QA Process

## Scope

This v1 automation runs the deeper browser QA checks against a deployed Quilt catalog. The default target is `https://nightly.quilttest.com`, and the default results bucket is `quilt-example-bucket`. It does not create a dedicated QA stack or bucket.

The runner covers release/version smoke validation, admin CRUD for e2e-prefixed users/roles/policies, persona role switching, anonymous access checks, package lifecycle creation/revision inspection, upload/download cleanup, search/filtering, Athena smoke checks, lightweight visual evidence, and basic accessibility/performance diagnostics.

## Trigger

The only committed trigger for v1 is the manual GitHub Actions `workflow_dispatch` workflow in `.github/workflows/rc-deeper-qa.yaml`. Tag, release, and `repository_dispatch` triggers are intentionally not wired yet.

## Required Secrets

The workflow expects an encrypted browser session profile file in the repository and one small repository secret:

- Encrypted file: `catalog/qa/deeper-rc/secrets/deeper-rc-browser-profile.tgz.gpg`
- Secret: `QUILT_QA_BROWSER_PROFILE_PASSPHRASE`

The encrypted file is a GPG-encrypted `.tgz` of the Playwright/Chrome profile after a real user completes Microsoft federated login. The workflow decrypts it into `catalog/.playwright-mcp/deeper-rc-browser-profile.tgz`, sets `QA_BROWSER_PROFILE_TGZ`, restores that archive into `catalog/.playwright-mcp/nightly-visible-profile`, and then runs the QA browser from the restored session.

The old `QUILT_QA_BROWSER_PROFILE_TGZ_B64` secret remains a runner fallback, but it is no longer recommended. GitHub Actions secrets are capped at a small value size, and browser profiles often exceed that cap even after pruning, which causes `gh secret set` to fail with HTTP 422 `Value is too large`.

Local runs can use an existing authenticated profile at `catalog/.playwright-mcp/nightly-visible-profile`. If no profile exists, run the local bootstrap flow below.

`QA_AUTH_MODE=credentials` still exists as a legacy fallback for environments that already have `QUILT_QA_USERNAME` and `QUILT_QA_PASSWORD`, but those secrets are no longer required or configured by the GitHub workflow.

## Microsoft Federated Auth

Microsoft federated login is browser-interactive. It can require MFA, consent prompts, device compliance, conditional access, or other tenant policies. A GitHub-hosted runner cannot click through those challenges or satisfy an MFA prompt by itself.

For v1, CI therefore uses a pre-established browser session:

1. A release/QA owner runs the headed bootstrap locally.
2. They complete Microsoft login in the browser using the intended QA identity.
3. The runner exports the authenticated browser profile as a plaintext `.tgz`.
4. They encrypt the `.tgz` with GPG and commit only the `.tgz.gpg` file.
5. They store only the GPG passphrase in `QUILT_QA_BROWSER_PROFILE_PASSPHRASE`.
6. GitHub Actions decrypts and restores that profile before launching Playwright.

Bootstrap or rotate the profile from `catalog`:

```bash
npm ci
npx playwright install chrome
QA_AUTH_MODE=microsoft-interactive npm run qa:deeper-rc

PASSPHRASE="$(openssl rand -base64 32)"
mkdir -p qa/deeper-rc/secrets
gpg --symmetric --cipher-algo AES256 --batch --yes --pinentry-mode loopback \
  --passphrase "$PASSPHRASE" \
  -o qa/deeper-rc/secrets/deeper-rc-browser-profile.tgz.gpg \
  .playwright-mcp/deeper-rc-browser-profile.tgz
gh secret set QUILT_QA_BROWSER_PROFILE_PASSPHRASE --body "$PASSPHRASE"
git add qa/deeper-rc/secrets/deeper-rc-browser-profile.tgz.gpg
```

Alternatively, generate the encrypted file during bootstrap by supplying the passphrase to the runner:

```bash
PASSPHRASE="$(openssl rand -base64 32)"
QA_AUTH_MODE=microsoft-interactive \
  QA_PROFILE_ENCRYPT_PASSPHRASE="$PASSPHRASE" \
  npm run qa:deeper-rc
gh secret set QUILT_QA_BROWSER_PROFILE_PASSPHRASE --body "$PASSPHRASE"
git add qa/deeper-rc/secrets/deeper-rc-browser-profile.tgz.gpg
```

Rotate the encrypted file and passphrase whenever the Microsoft/Quilt session expires, the QA user's permissions change, tenant policy forces re-authentication, or the test identity is replaced. Do not commit `.playwright-mcp/deeper-rc-browser-profile.tgz`, `.playwright-mcp/deeper-rc-browser-profile.tgz.b64`, or any other plaintext profile export.

This is not true non-interactive Microsoft federation. The codebase currently exposes the Microsoft path through the catalog browser OIDC popup (`/oidc-authorize/azure`), and no supported CI token exchange or device-code login path was found in the current app. Better future options are a dedicated machine/test identity with compatible conditional-access policy, or a Quilt-issued service token/OIDC exchange if the product supports one.

## Inputs And Environment

Workflow inputs map to runner environment variables:

- `expected_stack_version` -> `QA_EXPECTED_VERSION`, default `1.70`.
- `target_url` -> `QA_TARGET_URL`, default `https://nightly.quilttest.com`.
- `results_bucket` -> `QA_BUCKET`, default `quilt-example-bucket`.
- `qa_package_name` -> `QA_PACKAGE_NAME`, optional. If empty, the runner uses `qa/nightly-${normalizedVersion}-rc-deeper-qa`.
- `skip_wait` -> `QA_SKIP_WAIT`, reserved for a future readiness wait.

Additional runner defaults:

- `QA_OUTPUT_ROOT` defaults to `catalog/.playwright-mcp`.
- `QA_AUTH_MODE` defaults to `profile`.
- `QA_PROFILE_DIR` defaults to `catalog/.playwright-mcp/nightly-visible-profile`.
- `QA_BROWSER_PROFILE_GPG` defaults in CI to `catalog/qa/deeper-rc/secrets/deeper-rc-browser-profile.tgz.gpg`.
- `QA_BROWSER_PROFILE_TGZ` points the runner at the decrypted profile archive; the workflow writes it to `catalog/.playwright-mcp/deeper-rc-browser-profile.tgz`.
- `QA_PROFILE_EXPORT_PATH` defaults to `catalog/.playwright-mcp/deeper-rc-browser-profile.tgz` for local bootstrap.
- `QA_PROFILE_ENCRYPT_PASSPHRASE` optionally encrypts the bootstrap export to `catalog/qa/deeper-rc/secrets/deeper-rc-browser-profile.tgz.gpg`.
- `QA_ARTIFACT_PACKAGE_NAME` defaults to `qa/nightly-${normalizedVersion}-rc-release-artifacts`, but v1 includes release artifacts in the deeper QA package instead of publishing a separate package.

## Outputs

The runner writes local artifacts under `catalog/.playwright-mcp/nightly-${normalizedVersion}-deeper-qa-${runId}`. GitHub Actions uploads that directory as a workflow artifact.

When publishing succeeds, the runner also uploads the evidence files to S3 under `qa-results/nightly-${normalizedVersion}-rc-deeper/${runId}/` and constructs the configured Quilt package using the catalog GraphQL `packageConstruct` mutation.

Important files:

- `README.md`: human-readable QA report.
- `qa-summary.json`: machine-readable run summary.
- `publish-result.json`: final package URL/revision when available.
- `screenshots/`: visual evidence and failure screenshots.
- `data/`: findings, cleanup records, persona matrix, release metadata, Athena evidence, and timing/accessibility smoke data.

## Failure Policy

QA findings are report data, not workflow failures. Individual check failures are captured as findings and encoded in `README.md` and `qa-summary.json`.

The runner exits nonzero only when it cannot complete or publish due to a runner bug or infrastructure failure. The workflow still uploads any local artifacts it can find, writes a job summary, and then fails the job at the final step if the runner exit code was nonzero.

## Handoff

V1 is package-only. It does not create GitHub issues, Slack messages, or Asana tasks. Release owners should inspect the package URL, report summary, findings list, and screenshots from the package or the GitHub Actions artifact.

## Running Locally

From `catalog`:

```bash
npm ci
npx playwright install chrome
QA_EXPECTED_VERSION=1.70 npm run qa:deeper-rc
```

To inspect configuration without launching the browser QA:

```bash
npm run qa:deeper-rc -- --help
```
