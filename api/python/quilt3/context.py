"""
Quilt-observed commit context.

Collects what Quilt can observe about a package commit — the effective AWS
principal, the authentication path, the quilt3 client version, and a UTC
timestamp — and merges it into package-level user metadata at
``<namespace>.quilt``.

This module owns only Quilt-observed context: it never creates, infers, or
validates sibling keys such as ``context.agent`` or ``context.inputs``. It
knows nothing about ``Package`` or argparse; it takes a metadata dict in and
returns a new one out.
"""

import copy
import datetime
import re

from . import session
from .util import QuiltException

CONTEXT_VERSION = 1
QUILT_KEY = "quilt"

_NAMESPACE_PATTERN = "^[a-z][a-z0-9_-]*$"
_NAMESPACE_RE = re.compile(_NAMESPACE_PATTERN)
_TIMESTAMP_FORMAT = "%Y-%m-%dT%H:%M:%S.%fZ"


def _utc_now():
    """Return the current UTC time. Split out so tests can freeze the clock."""
    return datetime.datetime.now(tz=datetime.timezone.utc)


def validate_namespace(namespace):
    """
    Ensure `namespace` is a valid single top-level metadata key.

    Raises:
        QuiltException: when `namespace` is not a string matching ^[a-z][a-z0-9_-]*$.
    """
    if not isinstance(namespace, str) or not _NAMESPACE_RE.fullmatch(namespace):
        raise QuiltException(
            f"Invalid Quilt context namespace {namespace!r}: must be a single "
            f"top-level key matching {_NAMESPACE_PATTERN}."
        )


_QUILT_CONTEXT_KEYS = frozenset({"version", "timestamp", "client", "principal", "authentication"})


def _is_quilt_shaped(value):
    """
    True when `value` looks exactly like this module's own output: an object
    carrying precisely the keys `collect()` writes. Missing or extra keys
    mean the value is not ours and must not be replaced.
    """
    return isinstance(value, dict) and value.keys() == _QUILT_CONTEXT_KEYS


def _check_mergeable(meta, namespace):
    """
    Validate that `meta` can accept Quilt context at `<namespace>.quilt`.

    A pre-existing `<namespace>.quilt` is allowed only when it is exactly
    Quilt-shaped (see `_is_quilt_shaped`) — the value a previous embed wrote,
    arriving legitimately via the package `push()` returns (which shares
    `_meta`) or a `Package.browse()` round-trip. The merge replaces it with
    freshly collected context. Anything else at that key is refused, so
    caller-supplied content is never silently discarded.

    Raises:
        QuiltException: when `meta` is not an object, the namespace value is
            not an object, or `<namespace>.quilt` exists and is not
            Quilt-shaped.
    """
    if meta is None:
        return
    if not isinstance(meta, dict):
        raise QuiltException("Cannot embed Quilt context: package user metadata is not an object.")
    if namespace not in meta:
        return
    if not isinstance(meta[namespace], dict):
        raise QuiltException(f"Cannot embed Quilt context: metadata key {namespace!r} is not an object.")
    if QUILT_KEY in meta[namespace] and not _is_quilt_shaped(meta[namespace][QUILT_KEY]):
        raise QuiltException(
            f"Cannot embed Quilt context: {namespace}.{QUILT_KEY} already exists "
            "and was not written by Quilt. Quilt-observed context cannot be "
            "caller-supplied, and non-Quilt values are never overwritten."
        )


def _quilt_catalog_confirmed():
    """
    True only when the currently configured registry has its own auth-token
    entry in the auth store.

    This is deliberately narrower than `logged_in()`: `logged_in()` also
    returns truthy when an API key is set, regardless of which registry that
    key is for, and `_load_credentials()` is a single global cache with no
    record of which catalog issued it. Neither, alone, proves that the AWS
    credentials backing the current session were issued by the catalog
    `logged_in()` currently reports — e.g. a user who logs into catalog A,
    then switches to catalog B via `quilt3.config()` and authenticates there
    with an API key (which never touches the credentials cache), would still
    have catalog A's cached AWS credentials on disk. Requiring a token
    entry for the *current* registry specifically confirms that a real
    catalog login happened for the registry now configured, closing the
    common versions of that gap using only existing session state.

    One residual gap this does not close: the auth store *merges* across
    registries while the credentials cache is a single global slot, so
    "login to A, `config(B)` and login to B, `config(A)` back without
    re-login" leaves A confirmed here while the cached credentials are still
    B's — the recorded catalog misattributes the principal until those
    credentials expire and refresh against A. Closing it would require
    stamping cached credentials with their issuing registry, which the cache
    format does not record today.
    """
    return session.get_registry_url() in session._load_auth()


def collect():
    """
    Collect Quilt-observed context, resolving identity and time exactly once.

    Identity comes from STS `get_caller_identity()` on Quilt's effective Boto3
    session (`get_boto3_session(fallback=True)`). `authentication.type` is
    decided by the credential path alone: `quilt-catalog` when both cached
    Quilt credentials exist and the currently configured registry is
    independently confirmed as logged in (see `_quilt_catalog_confirmed`);
    otherwise `aws`. `authentication.catalog` then identifies the deployment
    that issued the credentials: the navigator URL from `logged_in()` when
    the config carries one, else the registry URL that confirmed the login —
    so a config holding `registryUrl` without `navigator_url` (reachable via
    `quilt3.config(registryUrl=...)` or a `configure_from_default()`
    fallback) still records the catalog path truthfully. `catalog` is present
    iff `type == "quilt-catalog"`, the invariant required by the companion
    Agent Context schema.

    Raises:
        QuiltException: when STS identity cannot be resolved, including a
            response missing an expected field. The underlying exception is
            not chained on (neither as `__cause__` nor as the implicit
            `__context__`), so its text — which may contain credential
            material — cannot reach a traceback, log, or error reporter
            walking either chain.
    """
    import quilt3

    timestamp = _utc_now().strftime(_TIMESTAMP_FORMAT)
    quilt_credentials_cached = bool(session._load_credentials())

    sts_failure = None
    principal = None
    try:
        identity = session.get_boto3_session(fallback=True).client("sts").get_caller_identity()
        principal = {
            "account": identity["Account"],
            "arn": identity["Arn"],
            "user_id": identity["UserId"],
        }
    except Exception as ex:
        sts_failure = QuiltException(
            "Failed to resolve AWS identity for Quilt context "
            f"(resolving STS caller identity raised {type(ex).__name__}); nothing was pushed."
        )
    # Raised outside the except block so the STS exception is not attached as
    # the implicit __context__ (see Raises above) — `raise ... from None`
    # inside the block would clear __cause__ but leave __context__ set.
    if sts_failure is not None:
        raise sts_failure

    is_quilt_catalog = quilt_credentials_cached and _quilt_catalog_confirmed()
    authentication = {"type": "quilt-catalog"} if is_quilt_catalog else {"type": "aws"}
    if is_quilt_catalog:
        # logged_in() reads the display URL (navigator_url), which documented
        # config paths can leave unset; the registry URL that confirmed the
        # login always exists and identifies the same deployment.
        authentication["catalog"] = session.logged_in() or session.get_registry_url()

    return {
        "version": CONTEXT_VERSION,
        "timestamp": timestamp,
        "client": f"quilt3/{quilt3.__version__}",
        "principal": principal,
        "authentication": authentication,
    }


def merge_quilt_context(meta, namespace="context"):
    """
    Return a new metadata dict with collected Quilt context merged in at
    `<namespace>.quilt`, per the merge rules: missing metadata (`None`) is
    treated as an empty object, the caller's dict is copied before
    modification (never mutated in place), and every existing top-level key
    and every existing sibling inside the namespace is preserved. A
    `<namespace>.quilt` value a previous embed wrote (see `_is_quilt_shaped`)
    is replaced with freshly collected context; any other pre-existing value
    at that key is refused.

    All validation failures raise before any AWS call is made.

    Raises:
        QuiltException: on an invalid namespace, non-object metadata, a
            non-object namespace value, a pre-existing `<namespace>.quilt`
            value that Quilt itself did not write, or failure to resolve STS
            identity.
    """
    validate_namespace(namespace)
    _check_mergeable(meta, namespace)
    quilt_context = collect()
    new_meta = copy.deepcopy(meta) if meta is not None else {}
    new_meta.setdefault(namespace, {})[QUILT_KEY] = quilt_context
    return new_meta
