"""
Tests for Package.set_quilt_context — Quilt-observed commit context embedded
at <namespace>.quilt in package-level user metadata.
"""

import contextlib
import copy
import datetime
import hashlib
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


@contextlib.contextmanager
def mock_quilt_context(
    *,
    credentials=None,
    logged_in_url=None,
    identity=STS_IDENTITY,
    sts_error=None,
    now=FIXED_NOW,
):
    """
    Patch the clock, the Quilt credential cache, the effective Boto3 session,
    and the catalog login lookup, so no test needs network or live credentials.
    """
    sts_client = mock.Mock(name="sts_client")
    if sts_error is None:
        sts_client.get_caller_identity.return_value = identity
    else:
        sts_client.get_caller_identity.side_effect = sts_error
    boto_session = mock.Mock(name="boto3_session")
    boto_session.client.return_value = sts_client

    clock = mock.patch.object(quilt_context, "_utc_now", return_value=now)
    with (
        clock if now is not None else contextlib.nullcontext(),
        mock.patch.object(quilt3.session, "_load_credentials", return_value=credentials or {}),
        mock.patch.object(quilt3.session, "get_boto3_session", return_value=boto_session) as get_boto3_session_mock,
        mock.patch.object(quilt3.session, "logged_in", return_value=logged_in_url),
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

            # Independently re-derive the manifest top hash for an empty
            # package: sha256 over the compact, key-sorted JSON of the
            # package-level metadata (no entries).
            expected = hashlib.sha256(
                json.JSONEncoder(sort_keys=True, separators=(",", ":"))
                .encode({"version": "v0", "user_meta": meta})
                .encode()
            ).hexdigest()
            assert pkg.top_hash == expected
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
        for namespace in ["Context", "context.quilt", "9ns", "", " ", "con text", "-x", "ns.", None, 1]:
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

    # 8. A caller-supplied quilt key fails before push.
    def test_existing_quilt_key_fails_before_aws(self):
        pkg = Package().set_meta({"context": {"quilt": {"version": 1}}})
        with mock_quilt_context() as mocks:
            with self.assertRaises(QuiltException):
                pkg.set_quilt_context()
        mocks.get_boto3_session.assert_not_called()
        assert pkg.meta == {"context": {"quilt": {"version": 1}}}

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
        with (
            mock.patch.object(Package, "push") as push_mock,
            mock_quilt_context(sts_error=Exception("identity lookup failed")),
        ):
            with self.assertRaises(QuiltException) as raised:
                pkg.set_quilt_context()
                pkg.push("test/pkg")
        push_mock.assert_not_called()
        assert pkg.meta == {}
        assert "identity" in str(raised.exception).lower()

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
        # material, the QuiltException message must not repeat it.
        sts_error = Exception(f"rejected credentials {' '.join(secrets)}")
        with mock_quilt_context(credentials=FAKE_QUILT_CREDENTIALS, sts_error=sts_error):
            with self.assertRaises(QuiltException) as raised:
                Package().set_quilt_context()
        assert raised.exception.__cause__ is sts_error
        for secret in secrets:
            assert secret not in str(raised.exception)
