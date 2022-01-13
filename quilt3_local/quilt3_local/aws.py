import functools
import io
import json

import aiobotocore.session
import botocore

from . import context

# only applicable to aiobotocore clients
# BOTO_MAX_POOL_CONNECTIONS = 200
BOTO_MAX_POOL_CONNECTIONS = 10

# XXX: use signle session/cache for all clients?
get_aio_boto_session = context.cached(aiobotocore.session.get_session)


@context.cached
async def get_aio_s3():
    return await context.enter_async_context(
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
