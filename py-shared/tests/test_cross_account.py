import datetime

from quilt_shared import cross_account


def test_assumed_bucket_client_refreshes_expired_credentials(mocker):
    role_arn = "arn:aws:iam::123456789012:role/example"
    expiration1 = datetime.datetime(2026, 4, 18, 12, 0, tzinfo=datetime.timezone.utc)
    expiration2 = datetime.datetime(2026, 4, 18, 13, 0, tzinfo=datetime.timezone.utc)
    sts_client = mocker.Mock()
    sts_client.assume_role.side_effect = [
        {"Credentials": _credentials(expiration1)},
        {"Credentials": _credentials(expiration2)},
    ]
    session_factory = mocker.patch("quilt_shared.cross_account.boto3.session.Session")
    session_factory.side_effect = [mocker.Mock(client=mocker.Mock(return_value="client-1")), mocker.Mock(client=mocker.Mock(return_value="client-2"))]
    mocker.patch("quilt_shared.cross_account.boto3.client", return_value=sts_client)
    mocker.patch("quilt_shared.cross_account._utcnow", side_effect=[
        datetime.datetime(2026, 4, 18, 11, 30, tzinfo=datetime.timezone.utc),
        datetime.datetime(2026, 4, 18, 11, 56, tzinfo=datetime.timezone.utc),
    ])
    cross_account._ASSUMED_CLIENT_CACHE.clear()

    client1 = cross_account._assumed_bucket_client(role_arn, None)
    client2 = cross_account._assumed_bucket_client(role_arn, None)
    client3 = cross_account._assumed_bucket_client(role_arn, None)

    assert client1 == "client-1"
    assert client2 == "client-1"
    assert client3 == "client-2"
    assert sts_client.assume_role.call_count == 2


def test_bucket_role_aware_client_uses_positional_bucket_arg(mocker):
    default_client = mocker.Mock()
    default_client.meta.method_to_api_mapping = {"get_object": "GetObject"}
    operation_model = mocker.Mock()
    operation_model.input_shape = mocker.Mock(members={"Bucket": mocker.sentinel.bucket, "Key": mocker.sentinel.key})
    default_client.meta.service_model.operation_model.return_value = operation_model
    default_client.get_object = mocker.Mock(return_value="default")
    role_client = mocker.Mock()
    role_client.get_object = mocker.Mock(return_value="assumed")
    mocker.patch("quilt_shared.cross_account.boto3.client", return_value=default_client)
    mocker.patch("quilt_shared.cross_account.get_role_map", return_value={"bucket-1": "role-arn"})
    mocker.patch("quilt_shared.cross_account._assumed_bucket_client", return_value=role_client)

    client = cross_account.BucketRoleAwareS3Client()

    assert client.get_object("bucket-1", "key-1") == "assumed"
    role_client.get_object.assert_called_once_with("bucket-1", "key-1")
    default_client.get_object.assert_not_called()


def _credentials(expiration):
    return {
        "AccessKeyId": "access-key",
        "SecretAccessKey": "secret-key",
        "SessionToken": "session-token",
        "Expiration": expiration,
    }
