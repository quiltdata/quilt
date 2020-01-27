"""Live tests that run against actual S3 buckets"""
import subprocess

import pytest
from unittest import TestCase

import quilt3

@pytest.mark.live
class LiveTestCases(TestCase):
    def test_public_bucket_install(self):
        """test public install and CLI verify"""
        TMP_DIR = "tmpdir"
        quilt3.Package.install(
            "akarve/many-revisions",
            top_hash="45a2ec85",
            registry="s3://quilt-example",
            dest=TMP_DIR
        )

        verification = subprocess.check_output([
            "quilt3",
            "verify",
            "akarve/many-revisions",
            "--top-hash",
            "45a2ec85",
            "--dir",
            TMP_DIR,
            "--registry",
            "s3://quilt-example"
        ])

        assert "succeeded" in verification.decode(), \
            "Failed to verify akarve/many-revisions@45a2ec85"


    def test_private_bucket_push(self):
        p = quilt3.Package.browse(
            "akarve/many-revisions",
            top_hash="45a2ec85",
            registry="s3://quilt-example",
        )

        p.push("akarve/many-revisions-test", registry="s3://quilt-t4-staging")
