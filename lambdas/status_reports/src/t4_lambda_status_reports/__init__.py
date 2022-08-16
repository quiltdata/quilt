import asyncio
import functools
import itertools
import os

import aiobotocore.session

# import boto3

# from t4_lambda_shared.utils import LAMBDA_TMP_SPACE, get_quilt_logger
from t4_lambda_shared.utils import get_quilt_logger


CANARIES_PER_REQUEST = 5

# event_bridge = boto3.client('events')
# s3 = boto3.client('s3')
logger = get_quilt_logger()

# XXX: assert?
STACK_NAME = os.getenv("STACK_NAME")
AWS_REGION = os.getenv("AWS_REGION")


# def exception_handler(f):
#     @functools.wraps(f)
#     def wrapper(event, _context):
#         try:
#             return {"result": f(event)}
#         except PkgpushException as e:
#             traceback.print_exc()
#             return {"error": e.asdict()}
#     return wrapper


async def list_canaries(cfn) -> list[str]:
    result = []
    async for page in cfn.get_paginator("list_stack_resources").paginate(StackName=STACK_NAME):
        for r in page["StackResourceSummaries"]:
            if r["ResourceType"] == "AWS::Synthetics::Canary":
                result.append(r["PhysicalResourceId"])
    return []


async def drain(syn, method: str, key: str, names: list[str]) -> list[dict]:
    chunks = [
        names[i:i + CANARIES_PER_REQUEST]
        for i in range(0, len(names), CANARIES_PER_REQUEST)
    ]
    pages = await asyncio.gather(*[
        getattr(syn, method)(Names=chunk)
        for chunk in chunks
    ])
    return list(itertools.chain(*[p[key] for p in pages]))


async def query_status(syn, cfn) -> dict:
    names = await list_canaries(cfn)
    describe_result, describe_last_run_result = await asyncio.gather(
        drain(syn, "describe_canaries", "Canaries", names),
        drain(syn, "describe_canaries_last_run", "CanariesLastRun", names),
    )

    canary_map = {}
    for c in describe_result:
        canary_map[c["Name"]] = {
            "name": c["Name"],
            "region": AWS_REGION,
            "schedule": c["Schedule"]["Expression"],
            "group": c["Tags"]["Group"],
            "title": c["Tags"]["Title"],
            "description": c["Tags"]["Description"],
            "ok": None,
            "lastRun": None,
        }

    for r in describe_last_run_result:
        name = r["CanaryName"]
        if name in canary_map and "LastRun" in r:
            state = r["LastRun"]["Status"]["State"]
            # if canary is still running, then Status.State == RUNNING
            # and there is no Timeline.Completed --
            # in this case we should fetch results of the previous run
            if state in ("PASSED", "FAILED"):
                canary_map[name].update(
                    ok=state == "PASSED",
                    lastRun=r["LastRun"]["Timeline"]["Completed"],
                )

    canaries = list(canary_map.values())

    for c in canaries:
        if c["ok"] is not None:
            continue

        runs = (await syn.get_canary_runs(Name=c["name"], MaxResults=2))["CanaryRuns"]
        if len(runs) <= 1:
            continue

        prev = runs[1]
        state = prev["Status"]["State"]
        if state == "RUNNING":
            c.update(lastRun=prev["Timeline"]["Started"])
        else:
            c.update(ok=state == "PASSED", lastRun=prev["Timeline"]["Completed"])

    return {
        "canaries": canaries,
        "latestStats": {
            "passed": len([c for c in canaries if c["ok"] is True]),
            "failed": len([c for c in canaries if c["ok"] is False]),
            "running": len([c for c in canaries if c["ok"] is None]),
        },
    }


def async_handler(f):
    @functools.wraps(f)
    def wrapper(event, context):
        return asyncio.run(f(event, context))

    return wrapper


# XXX: figure out input parameters
# XXX: what env vars to use?
# XXX: types of event and context?
@async_handler
async def generate_status_reports(event, _context):
    session = aiobotocore.session.get_session()
    async with \
        session.create_client("s3") as s3, \
        session.create_client("cloudformation", region_name=AWS_REGION) as cfn, \
        session.create_client("cloudwatch", region_name=AWS_REGION) as cw, \
        session.create_client("synthetics", region_name=AWS_REGION) as syn:

        # XXX
        status = await query_status(syn, cfn)
        return status
