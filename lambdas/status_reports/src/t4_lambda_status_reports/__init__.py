import asyncio
import functools
import itertools
import os
import typing as T

import aiobotocore.session
import jinja2

from t4_lambda_shared.utils import get_quilt_logger


CANARIES_PER_REQUEST = 5

logger = get_quilt_logger()

# XXX: assert?
STACK_NAME = os.getenv("STACK_NAME")
AWS_REGION = os.getenv("AWS_REGION")


async def list_canaries(cfn) -> T.List[str]:
    result = []
    async for page in cfn.get_paginator("list_stack_resources").paginate(StackName=STACK_NAME):
        for r in page["StackResourceSummaries"]:
            if r["ResourceType"] == "AWS::Synthetics::Canary":
                result.append(r["PhysicalResourceId"])
    return result


async def drain(syn, method: str, key: str, names: T.List[str]) -> T.List[dict]:
    chunks = [
        names[i:i + CANARIES_PER_REQUEST]
        for i in range(0, len(names), CANARIES_PER_REQUEST)
    ]
    pages = await asyncio.gather(*[
        getattr(syn, method)(Names=chunk)
        for chunk in chunks
    ])
    return list(itertools.chain(*[p[key] for p in pages]))


async def get_data(syn, cfn) -> dict:
    names = await list_canaries(cfn)
    describe_result, describe_last_run_result = await asyncio.gather(
        drain(syn, "describe_canaries", "Canaries", names),
        drain(syn, "describe_canaries_last_run", "CanariesLastRun", names),
    )

    canary_map = {}
    for c in describe_result:
        # XXX: use dataclasses?
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


jenv = jinja2.Environment(autoescape=jinja2.select_autoescape())
tmpl = jenv.from_string(
"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Status Report</title>
</head>
<body>
    <h1>Status Report</h1>
    <table>
        <thead>
            <tr>
                <th>Group / Title </th>
                <th>Schedule</th>
                <th>State</th>
                <th>Last Run</th>
            </tr>
        </thead>
        <tbody>
            {% for canary in canaries %}
                <tr>
                    <td>{{ canary.group }} / {{ canary.title }}</td>
                    <td>{{ canary.schedule }}</td>
                    <td>
                        {% if canary.ok %}
                            Passed
                        {% elif canary.ok == False %}
                            Failed
                        {% else %}
                            Running
                        {% endif %}
                    </td>
                    <td>
                        {% if canary.lastRun %}
                            {{ canary.lastRun }}
                        {% else %}
                            N/A
                        {% endif %}
                    </td>

                </tr>
            {% endfor %}
        </tbody>
    </table>
</body>
</html>
"""
)


def async_handler(f):
    @functools.wraps(f)
    def wrapper(event, context):
        return asyncio.run(f(event, context))

    return wrapper


# XXX: figure out input parameters (are they even necessary?)
@async_handler
async def generate_status_reports(*_):
    session = aiobotocore.session.get_session()
    async with \
        session.create_client("s3") as s3, \
        session.create_client("cloudformation", region_name=AWS_REGION) as cfn, \
        session.create_client("cloudwatch", region_name=AWS_REGION) as cw, \
        session.create_client("synthetics", region_name=AWS_REGION) as syn:

        data = await get_data(syn, cfn)
        html = tmpl.render(data)
        # TODO: write html file to service bucket
        return html
