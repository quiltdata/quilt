---
plan_slug: data-products-1-compose
phase: design-note
rig: quilt
bead: qu-v7m
assumption: A12
status: accepted
created_at: 2026-08-14T00:00:00Z
updated_at: 2026-08-14T00:00:00Z
---

# The revocation-propagation window

This note records a gap between a contract and its realization. It is not a proposal,
and nothing here is scheduled to be fixed.

## What the contract says

`br-source-authorization` is written as an absolute. Every view-derived operation
authorizes the **consuming** principal against each resolved member and revision — never
the author's authority, **never a cached prior decision**, and never serving under stale
authority. `br-version-pin` repeats the same rule on the pinned path: a pin conveys no
authority, and every pinned read re-authorizes. See
[`implementation-plan.md`](implementation-plan.md) lines 200-218.

Read literally, that absolute means a permission revoked at time *T* is refused at
*T + ε*.

## Two windows that contradict the absolute

The realization does not meet the absolute. Two standing invariants —
`invariant-iam-enforces` and `invariant-jwt-irrevocable` — record real windows in which an
already-issued credential continues to carry authority the registry has since withdrawn.

### Window 1 — AWS credential TTL

The registry cannot retroactively narrow a credential it has already issued. Within that
credential's TTL, the holder keeps the authority the credential was minted with.

**Bound: the TTL of the credential returned by `/auth/get_credentials`. The value is set
registry-side and is not verifiable in this repository.**

What this repo does show is that every client is a pure *consumer* of a registry-supplied
expiry and sets no duration of its own:

- `catalog/app/utils/AWS/Credentials.jsx:33-38` — the catalog fetches
  `/auth/get_credentials` and takes `expireTime` from the response's `Expiration` field.
  It supplies no duration parameter.
- `api/python/quilt3/session.py:289-298` — `quilt3` calls the same endpoint and stores
  `creds['Expiration']` verbatim as `expiry_time`.
- `api/python/quilt3/session.py:310-325` — refresh is delegated to botocore's
  `RefreshableCredentials`, which re-fetches on expiry. Nothing consults a revocation
  list; expiry is the only trigger.
- `py-shared/src/quilt_shared/aws.py:45-51` — `AWSCredentials.from_sts_response` carries
  key, secret, and token forward and **drops `Expiration` entirely**.

A repository-wide search for `DurationSeconds` and `MaxSessionDuration` matches **zero
files**. No `sts:AssumeRole` call is made anywhere in this repo; the only occurrence of the
string is a trust-policy `Action` in `docs/cfn-service-role.yaml:12`. Credential minting
lives in the registry backend (`quiltdata/enterprise`), which is not available here.

Assumption **A12** (`implementation-plan.md:48`) describes this window as "about an hour",
sourced from `invariant-iam-enforces`. That figure is consistent with the AWS STS default
`AssumeRole` duration of one hour, but **this repository contains nothing that confirms
it** — treat one hour as the invariant's recorded figure, not as a value verified here. An
operator who needs the real number must read it from the deployed registry or from an
issued credential's `Expiration`.

### Window 2 — agent access token lifetime

An already-issued agent access token stays valid until it expires. No denylist is
consulted on any request.

**Bound: the token's `exp` claim, set registry-side at issuance. The lifetime is not
verifiable in this repository.**

- `catalog/app/containers/Connect/Authorize.tsx:86-125` — the OAuth consent surface posts
  to `/connect/validate` and `/connect/authorize`. Token issuance, and therefore token
  lifetime, happens registry-side; no lifetime is visible on the catalog side.
- `catalog/app/components/Assistant/Model/Connectors/Mcp.ts:640-646` — the 1st-party MCP
  backend is bearer-passthrough: the caller resolves a bearer token (typically a catalog
  session JWT) on every call, and the backend "doesn't manage refresh, expiry, or session
  state."
- `catalog/app/components/Assistant/Model/Connectors/Mcp.ts:407-412` — a `401`/`403` from
  the server is the **only** revocation signal on this path. There is no denylist check
  before the request, and no local record of revoked tokens.
- `catalog/app/containers/Auth/Provider.js:52-62` and
  `catalog/app/containers/Auth/saga.js:12-17` — the catalog schedules its re-check at the
  registry-supplied `exp`, minus a fixed latency margin of **20 seconds**
  (`Provider.js:76`). That margin is the only client-side narrowing of the window, and it
  exists to absorb request latency, not to shorten authority.
- `api/python/quilt3/session.py:111-119` — `quilt3` refreshes its access token only when
  it is within **60 seconds** of expiry. Outside that band the cached token is reused with
  no revocation check.
- `api/python/quilt3/session.py:273-286` — `logout()` clears local state only, and carries
  the standing comment `# TODO revoke refresh token (without logging out of web
  sessions)`. Client-side logout is not server-side revocation.

## These windows are accepted, not closed

Per assumption **A12**, both windows are **ACCEPTED**. They are not fixed, not mitigated,
not scheduled, and no work in this plan narrows them.

A12 explicitly rules out the machinery that would close them: **do not build a denylist.**
The cost line records why — "a hard no-stale-authority ruling would require new
machinery." Closing these windows would mean per-request revocation checks on every
authorization decision, which is out of scope for this effort and is not filed as deferred
work behind it.

Do not read this note as a known issue awaiting a fix. It is a deliberate, recorded
acceptance. If the acceptance is ever overturned, A12 is the thing to revisit, and the
beads citing `assumption:A12` are the blast radius.

One class of credential is exempt and shows the contrast: **API keys are revocable.** The
schema carries `apiKeyRevoke` and `APIKeyRevokeResult`
(`shared/graphql/schema.graphql:84`, `:1257`), exposed as `quilt3.api_keys.revoke()`
(`api/python/quilt3/api_keys.py:114-117`), with expiry defaulting to 90 days and bounded to
1-365 (`shared/graphql/schema.graphql:79`, `api/python/quilt3/api_keys.py:90-99`).
Revoking an API key is effective; expiring a session or an issued AWS credential is not
something an operator can force from these surfaces.

## What an operator should expect after a revocation

After removing a user's access — unmapping a role, narrowing a permission, disabling an
account — expect the following until the relevant window elapses:

1. **New authorization decisions are correct immediately.** Any read that goes through the
   catalog or registry re-authorizes the consuming principal live and will refuse. The
   all-or-nothing `source-denied` behavior applies from the moment the change lands.

2. **Direct S3 access with an already-issued credential is not interrupted.** A credential
   minted before the change remains bound to the role it was issued for and continues to
   work against S3 until its `Expiration` — bypassing the catalog authorization path
   entirely. This is the substance of `invariant-iam-enforces`.

3. **An in-flight agent session keeps working until its token expires.** The MCP path
   forwards the bearer and checks nothing locally; the token stops working when the server
   starts returning 401/403, which happens at expiry rather than at revocation.

4. **Client-side logout proves nothing.** A user (or an agent) that has already obtained a
   token or credential retains it regardless of local logout
   (`api/python/quilt3/session.py:278`).

If a revocation must take effect faster than the window, it has to be enforced outside the
paths this plan touches — at the IAM policy attached to the role, or at the registry. Note
that an IAM policy edit affects **every** holder of that role, not one user, and the
precise propagation semantics of such an edit are an AWS/IAM property that this repository
neither configures nor documents. Verify against the deployed stack before relying on it.

## Not verifiable in this repository

Recorded so the gaps are not mistaken for zeroes:

| Value | Status |
| --- | --- |
| AWS credential TTL (numeric) | Registry-side; **not verifiable here**. A12 records "about an hour" from `invariant-iam-enforces`. |
| Agent access token lifetime (numeric) | Registry-side; **not verifiable here**. Arrives as the `exp` claim. |
| Refresh-token lifetime | **Not verifiable here.** |
| Whether the registry consults any denylist | **Not verifiable here.** No denylist exists on any client path in this repo. |

The registry backend lives in `quiltdata/enterprise`, a separate private repository not
available in this worktree. Anything above marked not verifiable must be read from there
or from the deployed stack — it should not be guessed.
