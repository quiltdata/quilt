from t4_lambda_manifest_indexer import _prepare_workflow_for_es


def test_prepare_workflow_for_es():
    assert _prepare_workflow_for_es(
        {
            "config": "s3://BUCKET/.quilt/workflows/config.yml?versionId=asdf",
            "id": "workflow-id",
            "schemas": {
                "schema-id": "schema-url",
            },
        },
        "BUCKET",
    ) == {
        "config_version_id": "asdf",
        "id": "workflow-id",
        "schemas": [
            {
                "id": "schema-id",
                "url": "schema-url",
            }
        ],
    }
