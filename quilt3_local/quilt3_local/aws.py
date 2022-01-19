import contextlib
import io
import json

import aiobotocore.session
import botocore

from .async_cache import cached

BOTO_MAX_POOL_CONNECTIONS = 100

get_aio_boto_session = cached()(aiobotocore.session.get_session)

# XXX: do we need to close this stack at some point? await global_context_stack.aclose()
global_context_stack = contextlib.AsyncExitStack()


@cached()
async def get_aio_s3():
    return await global_context_stack.enter_async_context(
        get_aio_boto_session().create_client("s3", config=botocore.config.Config(
            max_pool_connections=BOTO_MAX_POOL_CONNECTIONS,
        )),
    )


async def list_all_objects(**kw):
    s3 = await get_aio_s3()
    async for page in s3.get_paginator("list_objects_v2").paginate(**kw):
        for obj in page.get("Contents", ()):
            yield obj


class IncompleteResultException(Exception):
    """
    Exception indicating an incomplete response (e.g. from S3 Select)
    """


async def s3_select(*, ExpressionType="SQL", parse=True, **kwargs):
    s3 = await get_aio_s3()
    r = await s3.select_object_content(
        ExpressionType=ExpressionType,
        OutputSerialization={"JSON": {}},
        **kwargs,
    )

    buffer = io.BytesIO()
    end_event_received = False
    async for event in r["Payload"]:
        if "Records" in event:
            records = event["Records"]["Payload"]
            buffer.write(records)
        elif "End" in event:
            # End event indicates that the request finished successfully
            end_event_received = True

    if not end_event_received:
        raise IncompleteResultException("Error: Received an incomplete response from S3 Select.")

    buffer.seek(0)

    return [json.loads(line) for line in buffer] if parse else buffer
