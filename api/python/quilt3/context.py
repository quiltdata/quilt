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


def _check_mergeable(meta, namespace):
    """
    Validate that `meta` can accept Quilt context at `<namespace>.quilt`.

    Raises:
        QuiltException: when `meta` is not an object, the namespace value is
            not an object, or `<namespace>.quilt` already exists.
    """
    if meta is None:
        return
    if not isinstance(meta, dict):
        raise QuiltException("Cannot embed Quilt context: package user metadata is not an object.")
    if namespace not in meta:
        return
    if not isinstance(meta[namespace], dict):
        raise QuiltException(f"Cannot embed Quilt context: metadata key {namespace!r} is not an object.")
    if QUILT_KEY in meta[namespace]:
        raise QuiltException(
            f"Cannot embed Quilt context: {namespace}.{QUILT_KEY} already exists. "
            "Quilt-observed context cannot be caller-supplied or overwritten."
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
    """
    return session.get_registry_url() in session._load_auth()


def collect():
    """
    Collect Quilt-observed context, resolving identity and time exactly once.

    Identity comes from STS `get_caller_identity()` on Quilt's effective Boto3
    session (`get_boto3_session(fallback=True)`). `authentication.type` is
    `quilt-catalog` only when both cached Quilt credentials exist and the
    currently configured registry is independently confirmed as logged in
    (see `_quilt_catalog_confirmed`); otherwise `aws`. A catalog is never
    reported without also being the reason `authentication.type` is
    `quilt-catalog` (and vice versa), so the two invariants required by the
    companion Agent Context schema — `catalog` present iff
    `type == "quilt-catalog"` — always hold.

    Raises:
        QuiltException: when STS identity cannot be resolved. The exception
            resolving STS is not chained onto it (neither as `__cause__` nor
            as the implicit `__context__`), so its text — which may contain
            credential material — cannot reach a traceback, log, or error
            reporter walking either chain.
    """
    import quilt3

    timestamp = _utc_now().strftime(_TIMESTAMP_FORMAT)
    quilt_credentials_cached = bool(session._load_credentials())

    sts_failure = None
    identity = None
    try:
        identity = session.get_boto3_session(fallback=True).client("sts").get_caller_identity()
    except Exception as ex:
        sts_failure = QuiltException(
            "Failed to resolve AWS identity for Quilt context "
            f"(STS get_caller_identity raised {type(ex).__name__}); nothing was pushed."
        )
    if sts_failure is not None:
        raise sts_failure

    catalog = session.logged_in() if quilt_credentials_cached and _quilt_catalog_confirmed() else None
    is_quilt_catalog = catalog is not None
    authentication = {"type": "quilt-catalog"} if is_quilt_catalog else {"type": "aws"}
    if is_quilt_catalog:
        authentication["catalog"] = catalog

    return {
        "version": CONTEXT_VERSION,
        "timestamp": timestamp,
        "client": f"quilt3/{quilt3.__version__}",
        "principal": {
            "account": identity["Account"],
            "arn": identity["Arn"],
            "user_id": identity["UserId"],
        },
        "authentication": authentication,
    }


def merge_quilt_context(meta, namespace="context"):
    """
    Return a new metadata dict with collected Quilt context merged in at
    `<namespace>.quilt`, per the merge rules: missing metadata (`None`) is
    treated as an empty object, the caller's dict is copied before
    modification (never mutated in place), and every existing top-level key
    and every existing sibling inside the namespace is preserved.

    All validation failures raise before any AWS call is made.

    Raises:
        QuiltException: on an invalid namespace, non-object metadata, a
            non-object namespace value, a pre-existing `<namespace>.quilt`
            key, or failure to resolve STS identity.
    """
    validate_namespace(namespace)
    _check_mergeable(meta, namespace)
    quilt_context = collect()
    new_meta = copy.deepcopy(meta) if meta is not None else {}
    new_meta.setdefault(namespace, {})[QUILT_KEY] = quilt_context
    return new_meta
