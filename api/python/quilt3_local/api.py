import logging
import re

import ariadne.asgi
import boto3
import fastapi
from botocore.exceptions import ClientError

from . import search, settings
from .context import QuiltContext
from .graphql import schema as graphql_schema

logger = logging.getLogger(__name__)
PACKAGE_NAME_RE = re.compile(r"^[\w-]+/[\w-]+$")

api = fastapi.FastAPI()


@api.middleware("http")
async def add_quilt_context(request: fastapi.Request, call_next):
    with QuiltContext():
        return await call_next(request)


@api.get("/api/auth/get_credentials")
def get_credentials():
    if settings.filesystem_mode():
        return settings.fake_credentials()

    session_cred = boto3.Session().get_credentials()
    if session_cred is None:
        raise fastapi.HTTPException(503, "AWS credentials are required for LOCAL mode with the AWS object backend.")

    try:
        if session_cred.token:
            return {
                "AccessKeyId": session_cred.access_key,
                "SecretAccessKey": session_cred.secret_key,
                "SessionToken": session_cred.token,
                "Expiration": getattr(session_cred, "expiry_time", None),
            }
        sts_client = boto3.client("sts", region_name=settings.default_region())
        return sts_client.get_session_token()["Credentials"]
    except ClientError:
        logger.exception("Failed to get credentials for your AWS Account")
        raise fastapi.HTTPException(500, "Failed to get credentials for your AWS Account.")


@api.get("/api/search")
async def search_api(index: str, action: str):
    if action == "stats":
        return await search.search_stats(index)
    if action == "sample":
        return await search.search_sample(index)
    if action == "images":
        return await search.search_images(index)
    raise fastapi.HTTPException(404, f"Unsupported LOCAL search action: {action}")


@api.post("/api/package_name_valid")
async def package_name_valid(payload: dict):
    return {"valid": bool(PACKAGE_NAME_RE.match(payload.get("name") or ""))}


api.mount("/graphql", ariadne.asgi.GraphQL(graphql_schema), "GraphQL")
