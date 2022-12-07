import botocore

from . import aws, context


@context.cached
async def bucket_is_readable(bucket: str) -> bool:
    s3 = await aws.get_aio_s3()
    try:
        await s3.head_bucket(Bucket=bucket)
        return True
    except botocore.exceptions.ClientError as e:
        if e.response["Error"]["Code"] == "403":
            return False
        raise
