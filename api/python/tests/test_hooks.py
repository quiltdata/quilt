from botocore.stub import Stubber

from quilt3 import data_transfer, hooks, util


def test_build_client_hooks():
    try:
        assert hooks.get_build_s3_client_hook() is None

        stubber = None

        def event_handler(params, **kwargs):
            params.setdefault("ServerSideEncryption", "AES256")

        def hook(build_client_base, session, client_kwargs):
            client = build_client_base(session, client_kwargs)
            # use register_first and * to ensure that our hook runs before the stubber's one
            client.meta.events.register_first(f"before-parameter-build.*.*", event_handler)

            nonlocal stubber
            stubber = Stubber(client)
            stubber.add_response(
                "put_object",
                {},
                {
                    "Bucket": "bucket",
                    "Key": "key",
                    "Body": b"data",
                    "ServerSideEncryption": "AES256",
                },
            )
            stubber.activate()

            return client

        assert hooks.set_build_s3_client_hook(hook) is None
        assert hooks.get_build_s3_client_hook() is hook

        data_transfer.put_bytes(b"data", util.PhysicalKey("bucket", "key", None))

        assert stubber is not None
        stubber.assert_no_pending_responses()
    finally:
        hooks.set_build_s3_client_hook(None)
        assert hooks.get_build_s3_client_hook() is None
