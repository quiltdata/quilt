"""
Tests for Package.set_quilt_context — Quilt-observed commit context embedded
at <namespace>.quilt in package-level user metadata.
"""

import contextlib
import copy
import datetime
import json
import re
from types import SimpleNamespace
from unittest import mock

import quilt3
from quilt3 import Package, context as quilt_context
from quilt3.util import QuiltException

from .utils import QuiltTestCase

STS_IDENTITY = {
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/test-user",
    "UserId": "AIDAEXAMPLEUSERID",
}
FIXED_NOW = datetime.datetime(2026, 8, 22, 1, 2, 3, 45, tzinfo=datetime.timezone.utc)
FIXED_TIMESTAMP = "2026-08-22T01:02:03.000045Z"
TIMESTAMP_RE = re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z")
CATALOG_URL = "https://catalog.example.com"
FAKE_QUILT_CREDENTIALS = {
    "access_key": "AKIAFAKEFAKEFAKEFAKE",
    "secret_key": "fakeSecretKeyfakeSecretKeyfakeSecretKey1",
    "token": "FwoGZXIvYXdzEFakeSessionTokenFakeSessionToken",
    "expiry_time": "2026-08-23T00:00:00+00:00",
}


# mock_quilt_context patches session.get_registry_url() to return this and
# keys the fake auth store by it when registry_confirmed=True; nothing here
# depends on the registry QuiltTestCase configures.
CURRENT_REGISTRY_URL = "https://registry.example.com"


@contextlib.contextmanager
def mock_quilt_context(
    *,
    credentials=None,
    logged_in_url=None,
    registry_confirmed=True,
    identity=STS_IDENTITY,
    sts_error=None,
    now=FIXED_NOW,
):
    """
    Patch the clock, the Quilt credential cache, the effective Boto3 session,
    the catalog login lookup, and the auth store, so no test needs network or
    live credentials.

    `registry_confirmed` controls whether the *currently configured* registry
    has its own auth-store entry (see `context._quilt_catalog_confirmed`):
    defaults to True so tests not specifically about that distinction don't
    need to think about it, while `credentials=` alone still governs whether
    any Quilt credentials are cached at all.
    """
    sts_client = mock.Mock(name="sts_client")
    if sts_error is None:
        sts_client.get_caller_identity.return_value = identity
    else:
        sts_client.get_caller_identity.side_effect = sts_error
    boto_session = mock.Mock(name="boto3_session")
    boto_session.client.return_value = sts_client

    auth_store = {CURRENT_REGISTRY_URL: {"access_token": "fake"}} if registry_confirmed else {}

    clock = mock.patch.object(quilt_context, "_utc_now", return_value=now)
    with (
        clock if now is not None else contextlib.nullcontext(),
        mock.patch.object(quilt3.session, "_load_credentials", return_value=credentials or {}),
        mock.patch.object(quilt3.session, "get_boto3_session", return_value=boto_session) as get_boto3_session_mock,
        mock.patch.object(quilt3.session, "logged_in", return_value=logged_in_url),
        mock.patch.object(quilt3.session, "get_registry_url", return_value=CURRENT_REGISTRY_URL),
        mock.patch.object(quilt3.session, "_load_auth", return_value=auth_store),
    ):
        yield SimpleNamespace(get_boto3_session=get_boto3_session_mock, sts_client=sts_client)


class QuiltContextTest(QuiltTestCase):
    # 1. Never calling the method produces exactly the existing metadata and hash behavior.
    def test_no_call_preserves_existing_behavior(self):
        meta = {"context": {"agent": {"name": "a"}, "inputs": ["s3://b/k"]}, "other": 1}
        with mock.patch.object(
            quilt_context, "collect", side_effect=AssertionError("collect() must not be called")
        ) as collect_mock:
            pkg = Package().set_meta(meta)
            assert pkg.meta is meta
            assert pkg.top_hash  # hashing must not trigger collection either
        collect_mock.assert_not_called()

    # 2. The default namespace writes context.quilt.
    def test_default_namespace(self):
        pkg = Package()
        with mock_quilt_context():
            result = pkg.set_quilt_context()
        assert result is pkg
        assert pkg.meta == {
            "context": {
                "quilt": {
                    "version": 1,
                    "timestamp": FIXED_TIMESTAMP,
                    "client": f"quilt3/{quilt3.__version__}",
                    "principal": {
                        "account": STS_IDENTITY["Account"],
                        "arn": STS_IDENTITY["Arn"],
                        "user_id": STS_IDENTITY["UserId"],
                    },
                    "authentication": {"type": "aws"},
                }
            }
        }

    # 3. An explicit namespace writes provenance.quilt.
    def test_explicit_namespace(self):
        pkg = Package()
        with mock_quilt_context():
            assert pkg.set_quilt_context("provenance") is pkg
        assert list(pkg.meta) == ["provenance"]
        assert pkg.meta["provenance"]["quilt"]["version"] == 1

    # 4. An invalid namespace raises before any AWS call.
    def test_invalid_namespace_raises_before_aws(self):
        for namespace in [
            "Context",
            "context.quilt",
            "9ns",
            "",
            " ",
            "con text",
            "-x",
            "ns.",
            None,
            1,
            "context\n",  # `$` matches before a trailing newline; namespace must reject it anyway
        ]:
            with self.subTest(namespace=namespace):
                pkg = Package()
                with mock_quilt_context() as mocks:
                    with self.assertRaises(QuiltException):
                        pkg.set_quilt_context(namespace)
                mocks.get_boto3_session.assert_not_called()
                mocks.sts_client.get_caller_identity.assert_not_called()
                assert pkg.meta == {}

    # 5. Existing agent, inputs, and unrelated metadata survive unchanged.
    def test_preserves_siblings_and_unrelated_keys(self):
        meta = {
            "context": {"agent": {"name": "claude"}, "inputs": ["s3://bucket/key"]},
            "unrelated": {"nested": [1, 2, 3]},
        }
        pkg = Package().set_meta(meta)
        with mock_quilt_context():
            pkg.set_quilt_context()
        assert pkg.meta["context"]["agent"] == {"name": "claude"}
        assert pkg.meta["context"]["inputs"] == ["s3://bucket/key"]
        assert pkg.meta["unrelated"] == {"nested": [1, 2, 3]}
        assert pkg.meta["context"]["quilt"]["version"] == 1

    # 6. A non-object namespace fails before push.
    def test_non_object_namespace_fails_before_aws(self):
        for value in ["a string", ["a", "list"], 42]:
            with self.subTest(value=value):
                pkg = Package().set_meta({"context": value})
                with mock_quilt_context() as mocks:
                    with self.assertRaises(QuiltException):
                        pkg.set_quilt_context()
                mocks.get_boto3_session.assert_not_called()
                assert pkg.meta == {"context": value}

    # 7. Non-object user metadata fails before push.
    def test_non_object_user_meta_fails_before_aws(self):
        for value in [["a", "list"], "a string", 42]:
            with self.subTest(value=value):
                pkg = Package().set_meta(value)
                with mock_quilt_context() as mocks:
                    with self.assertRaises(QuiltException):
                        pkg.set_quilt_context()
                mocks.get_boto3_session.assert_not_called()

    # 8. A caller-supplied quilt key fails before push unless it is exactly
    # Quilt-shaped (the shaped case is replaced instead — see test 19).
    # Near-miss shapes must not qualify: a missing or extra key means the
    # value is not this module's output, and replacing it would silently
    # discard caller data.
    def test_existing_quilt_key_fails_before_aws(self):
        near_misses = [
            {"version": 1},
            "not an object",
            dict.fromkeys(quilt_context._QUILT_CONTEXT_KEYS - {"timestamp"}),
            dict.fromkeys(quilt_context._QUILT_CONTEXT_KEYS) | {"extra": 1},
        ]
        for value in near_misses:
            with self.subTest(value=value):
                meta = {"context": {"quilt": value}}
                pkg = Package().set_meta(copy.deepcopy(meta))
                with mock_quilt_context() as mocks:
                    with self.assertRaises(QuiltException):
                        pkg.set_quilt_context()
                mocks.get_boto3_session.assert_not_called()
                assert pkg.meta == meta

    # 9. The caller's metadata object is not mutated in place.
    def test_caller_metadata_not_mutated(self):
        meta = {"context": {"agent": {"name": "claude"}}}
        snapshot = copy.deepcopy(meta)
        pkg = Package().set_meta(meta)
        with mock_quilt_context():
            pkg.set_quilt_context()
        assert meta == snapshot
        assert pkg.meta is not meta
        assert pkg.meta["context"] is not meta["context"]

    # 10. Catalog credentials record quilt-catalog and the catalog URL.
    def test_catalog_credentials_record_quilt_catalog(self):
        pkg = Package()
        with mock_quilt_context(credentials=FAKE_QUILT_CREDENTIALS, logged_in_url=CATALOG_URL):
            pkg.set_quilt_context()
        assert pkg.meta["context"]["quilt"]["authentication"] == {
            "type": "quilt-catalog",
            "catalog": CATALOG_URL,
        }

    # 11. Ambient AWS credentials record aws and omit the catalog field,
    # including when logged_in() returns a catalog URL but no Quilt
    # credentials are cached.
    def test_ambient_aws_credentials_record_aws(self):
        for logged_in_url in [None, CATALOG_URL]:
            with self.subTest(logged_in_url=logged_in_url):
                pkg = Package()
                with mock_quilt_context(credentials={}, logged_in_url=logged_in_url):
                    pkg.set_quilt_context()
                assert pkg.meta["context"]["quilt"]["authentication"] == {"type": "aws"}

    # 11a. Cached Quilt credentials alone are not enough: unless the
    # *currently configured* registry has its own auth-store entry, the
    # cached AWS credentials cannot be proven to have come from the catalog
    # logged_in() reports (e.g. they could be stale from a different catalog
    # the caller switched away from via quilt3.config(), while now
    # authenticated to the new one only via an API key, which never touches
    # the credentials cache). Recording quilt-catalog in that case would be a
    # durable, wrong provenance claim, so it must fall back to aws.
    def test_unconfirmed_registry_records_aws_despite_cached_credentials(self):
        pkg = Package()
        with mock_quilt_context(
            credentials=FAKE_QUILT_CREDENTIALS, logged_in_url=CATALOG_URL, registry_confirmed=False
        ):
            pkg.set_quilt_context()
        assert pkg.meta["context"]["quilt"]["authentication"] == {"type": "aws"}

    # 11b. authentication never mixes the two shapes: quilt-catalog always
    # carries catalog, and aws never does — matching the companion Agent
    # Context schema's authentication oneOf.
    def test_authentication_shape_is_never_mixed(self):
        cases = [
            dict(credentials={}, logged_in_url=None, registry_confirmed=False),
            dict(credentials={}, logged_in_url=CATALOG_URL, registry_confirmed=True),
            dict(credentials=FAKE_QUILT_CREDENTIALS, logged_in_url=None, registry_confirmed=True),
            dict(credentials=FAKE_QUILT_CREDENTIALS, logged_in_url=CATALOG_URL, registry_confirmed=False),
            dict(credentials=FAKE_QUILT_CREDENTIALS, logged_in_url=CATALOG_URL, registry_confirmed=True),
        ]
        for kwargs in cases:
            with self.subTest(**kwargs):
                pkg = Package()
                with mock_quilt_context(**kwargs):
                    pkg.set_quilt_context()
                auth = pkg.meta["context"]["quilt"]["authentication"]
                if auth["type"] == "quilt-catalog":
                    assert auth.keys() == {"type", "catalog"}
                else:
                    assert auth.keys() == {"type"}

    # 12. Mocked STS values map exactly to account, arn, and user_id.
    def test_sts_fields_map_exactly(self):
        identity = {
            "Account": "999999999999",
            "Arn": "arn:aws:sts::999999999999:assumed-role/role-name/session-name",
            "UserId": "AROAEXAMPLE:session-name",
        }
        pkg = Package()
        with mock_quilt_context(identity=identity):
            pkg.set_quilt_context()
        assert pkg.meta["context"]["quilt"]["principal"] == {
            "account": "999999999999",
            "arn": "arn:aws:sts::999999999999:assumed-role/role-name/session-name",
            "user_id": "AROAEXAMPLE:session-name",
        }

    # 13. The timestamp has fixed UTC microsecond form.
    def test_timestamp_form(self):
        pkg = Package()
        with mock_quilt_context():
            pkg.set_quilt_context()
        assert pkg.meta["context"]["quilt"]["timestamp"] == FIXED_TIMESTAMP

        # Same form with the real clock.
        pkg = Package()
        with mock_quilt_context(now=None):
            pkg.set_quilt_context()
        assert TIMESTAMP_RE.fullmatch(pkg.meta["context"]["quilt"]["timestamp"])

    # 14. STS failure raises and prevents pkg.push from being called.
    def test_sts_failure_prevents_push(self):
        pkg = Package()

        def documented_usage():
            # Embed, then push — the raise from set_quilt_context is what
            # must keep push() unreached; push_mock below proves it.
            pkg.set_quilt_context()
            pkg.push("test/pkg")

        with (
            mock.patch.object(Package, "push") as push_mock,
            mock_quilt_context(sts_error=Exception("identity lookup failed")),
        ):
            with self.assertRaises(QuiltException) as raised:
                documented_usage()
        push_mock.assert_not_called()
        assert pkg.meta == {}
        assert "identity" in str(raised.exception).lower()
        # Not chained at all, so nothing walking __cause__ or the implicit
        # __context__ (tracebacks, logger.exception, error reporters) can
        # reach the original STS exception's text.
        assert raised.exception.__cause__ is None
        assert raised.exception.__context__ is None

    # 15. Identical bytes with different embedded context produce different top hashes.
    def test_different_context_different_top_hash(self):
        def embedded_top_hash(now):
            pkg = Package().set_meta({"payload": "identical"})
            with mock_quilt_context(now=now):
                pkg.set_quilt_context()
            return pkg.top_hash

        first = embedded_top_hash(FIXED_NOW)
        second = embedded_top_hash(FIXED_NOW + datetime.timedelta(microseconds=1))
        assert first != second

    # 16. A fixed clock and fixed STS response produce deterministic metadata and top hash.
    def test_fixed_clock_and_sts_deterministic(self):
        def embed():
            pkg = Package().set_meta({"context": {"agent": {"name": "claude"}}})
            with mock_quilt_context(credentials=FAKE_QUILT_CREDENTIALS, logged_in_url=CATALOG_URL):
                pkg.set_quilt_context()
            return pkg

        first, second = embed(), embed()
        assert first.meta == second.meta
        assert first.top_hash == second.top_hash

    # 17. Context set before push is visible to workflow validation.
    def test_context_visible_to_workflow_validation(self):
        seen = {}

        def fake_validate(*, registry, workflow, name, pkg, message):
            seen["meta"] = copy.deepcopy(pkg.meta)
            return None

        pkg = Package()
        with mock_quilt_context():
            pkg.set_quilt_context()
        with mock.patch.object(quilt3.workflows, "validate", side_effect=fake_validate):
            pkg.build("test/pkg")
        assert seen["meta"]["context"]["quilt"]["principal"]["account"] == STS_IDENTITY["Account"]

    # 18. No credential material appears in serialized metadata or error text.
    def test_no_credential_material_in_metadata_or_error_text(self):
        secrets = [
            FAKE_QUILT_CREDENTIALS["access_key"],
            FAKE_QUILT_CREDENTIALS["secret_key"],
            FAKE_QUILT_CREDENTIALS["token"],
        ]

        pkg = Package()
        with mock_quilt_context(credentials=FAKE_QUILT_CREDENTIALS, logged_in_url=CATALOG_URL):
            pkg.set_quilt_context()
        serialized = json.dumps(pkg.meta)
        for secret in secrets:
            assert secret not in serialized

        # Even when the underlying STS error itself carries credential
        # material, it must not be reachable at all: not in the message, not
        # as __cause__, and not as the implicit __context__ either — the
        # latter is what a bare `from ex` would still leak (traceback
        # printers, logger.exception(), and error reporters all walk it),
        # even though str() of the outer exception stays clean.
        sts_error = Exception(f"rejected credentials {' '.join(secrets)}")
        with mock_quilt_context(credentials=FAKE_QUILT_CREDENTIALS, sts_error=sts_error):
            with self.assertRaises(QuiltException) as raised:
                Package().set_quilt_context()
        assert raised.exception.__cause__ is None
        assert raised.exception.__context__ is None
        for secret in secrets:
            assert secret not in str(raised.exception)

    # 19. Re-embedding over context Quilt itself wrote replaces it. push()
    # returns a package sharing _meta and browse() round-trips the same
    # shape, so the second revision of a package pushed with the flag must
    # not fail — each revision's context reflects its own observation, and
    # the prior value survives in the prior revision's manifest.
    def test_reembed_replaces_prior_quilt_context(self):
        pkg = Package().set_meta({"context": {"agent": {"name": "claude"}}})
        with mock_quilt_context():
            pkg.set_quilt_context()
        first = copy.deepcopy(pkg.meta["context"]["quilt"])
        assert first["authentication"] == {"type": "aws"}

        later = FIXED_NOW + datetime.timedelta(seconds=1)
        with mock_quilt_context(credentials=FAKE_QUILT_CREDENTIALS, logged_in_url=CATALOG_URL, now=later):
            pkg.set_quilt_context()
        second = pkg.meta["context"]["quilt"]
        assert second["timestamp"] != first["timestamp"]
        assert second["authentication"] == {"type": "quilt-catalog", "catalog": CATALOG_URL}
        assert pkg.meta["context"]["agent"] == {"name": "claude"}

    # 20. A confirmed catalog login records quilt-catalog even when the
    # config has no navigator_url (logged_in() -> None) — reachable via
    # quilt3.config(registryUrl=...) or a configure_from_default() fallback.
    # The credential path decides type; catalog falls back to the registry
    # URL that confirmed the login, keeping catalog-iff-quilt-catalog intact.
    def test_confirmed_login_without_navigator_url_records_quilt_catalog(self):
        pkg = Package()
        with mock_quilt_context(credentials=FAKE_QUILT_CREDENTIALS, logged_in_url=None):
            pkg.set_quilt_context()
        assert pkg.meta["context"]["quilt"]["authentication"] == {
            "type": "quilt-catalog",
            "catalog": CURRENT_REGISTRY_URL,
        }

    # 21. An STS response missing an expected field is the same failure
    # class as an STS error: QuiltException with no exception chain, never
    # a bare KeyError.
    def test_malformed_sts_response_raises_quilt_exception(self):
        pkg = Package()
        with mock_quilt_context(identity={"Account": STS_IDENTITY["Account"]}):
            with self.assertRaises(QuiltException) as raised:
                pkg.set_quilt_context()
        assert raised.exception.__cause__ is None
        assert raised.exception.__context__ is None
        assert pkg.meta == {}
