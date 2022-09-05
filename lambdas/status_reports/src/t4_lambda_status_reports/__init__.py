import asyncio
import datetime
import functools
import itertools
import os
import typing as T

import aiobotocore.session
import jinja2

CANARIES_PER_REQUEST = 5

AWS_REGION = os.getenv("AWS_DEFAULT_REGION")
assert AWS_REGION


session = aiobotocore.session.get_session()


def create_cfn():
    return session.create_client("cloudformation")


def create_syn():
    return session.create_client("synthetics")


async def list_stack_canaries(cfn, stack_name: str) -> T.List[str]:
    result = []
    async for page in cfn.get_paginator("list_stack_resources").paginate(StackName=stack_name):
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
    return list(itertools.chain.from_iterable(p[key] for p in pages))


async def get_canaries(syn, cfn, stack_name: str) -> T.List[dict]:
    names = await list_stack_canaries(cfn, stack_name)
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

    return canaries


async def get_resources(cfn, stack_name: str) -> T.List[dict]:
    result = []
    async for page in cfn.get_paginator("list_stack_resources").paginate(StackName=stack_name):
        result.extend(page["StackResourceSummaries"])
    return result


async def get_stack_data(cfn, stack_name: str) -> dict:
    resp = await cfn.describe_stacks(StackName=stack_name)
    return resp["Stacks"][0]


jenv = jinja2.Environment(autoescape=jinja2.select_autoescape())
# TODO: styling
tmpl = jenv.from_string("""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Status Report</title>
</head>
<body>
    <h1>Quilt Status Report</h1>
    <dl>
        <dt>CloudFormation Stack:</dt>
        <dd>{{ stack_name }}</dd>
        <dt>AWS Region:</dt>
        <dd>{{ aws_region }}</dd>
        <dt>Timestamp:</dt>
        <dd>{{ now.isoformat() }}</dd>
    </dl>

    <h2>Operational Qualification</h2>
    <table>
        <thead>
            <tr>
                <th>Test</th>
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
                        {% elif canary.ok is false %}
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

    <h2>Installation Qualification</h2>

    <h3>Stack Resources</h3>
    <table>
        <thead>
            <tr>
                <th>Logical ID</th>
                <th>Physical ID</th>
                <th>Type</th>
                <th>Status</th>
                <th>Last Updated</th>
            </tr>
        </thead>
        <tbody>
            {% for r in resources %}
                <tr>
                    <td>{{ r.LogicalResourceId }}</td>
                    <td>{{ r.PhysicalResourceId }}</td>
                    <td>{{ r.ResourceType }}</td>
                    <td>{{ r.ResourceStatus }}</td>
                    <td>{{ r.LastUpdatedTimestamp.isoformat() }}</td>
                </tr>
            {% endfor %}
        </tbody>
    </table>

    <h3>Stack Outputs</h3>
    <table>
        <thead>
            <tr>
                <th>Output Key</th>
                <th>Value</th>
                <th>Description</th>
            </tr>
        </thead>
        <tbody>
            {% for o in stack_data.Outputs %}
                <tr>
                    <td>{{ o.OutputKey }}</td>
                    <td>{{ o.OutputValue }}</td>
                    <td>{{ o.Description }}</td>
                </tr>
            {% endfor %}
        </tbody>
    </table>

    <h3>Stack Parameters</h3>
    <table>
        <thead>
            <tr>
                <th>Parameter Key</th>
                <th>Value</th>
            </tr>
        </thead>
        <tbody>
            {% for p in stack_data.Parameters %}
                <tr>
                    <td>{{ p.ParameterKey }}</td>
                    <td>{{ p.ParameterValue }}</td>
                </tr>
            {% endfor %}
        </tbody>
    </table>
</body>
</html>
""")


async def generate_status_report(stack_name: str):
    async with create_cfn() as cfn, create_syn() as syn:
        now = datetime.datetime.utcnow()
        canaries, resources, stack_data = await asyncio.gather(
            get_canaries(syn, cfn, stack_name),
            get_resources(cfn, stack_name),
            get_stack_data(cfn, stack_name),
        )
        html = tmpl.render(
            stack_name=stack_name,
            aws_region=AWS_REGION,
            now=now,
            canaries=canaries,
            resources=resources,
            stack_data=stack_data,
        )
        return now, html


def async_handler(f):
    @functools.wraps(f)
    def wrapper(event, context):
        return asyncio.run(f(event, context))

    return wrapper


@async_handler
async def lambda_handler(*_):
    stack_name = os.getenv("STACK_NAME")
    assert stack_name
    bucket = os.getenv("STATUS_REPORTS_BUCKET")
    assert bucket

    now, html = await generate_status_report(stack_name)
    async with session.create_client("s3") as s3:
        key = now.strftime("%Y/%m/%d/%H-%M-%S.html")
        await s3.put_object(
            Bucket=bucket,
            Key=key,
            Body=html,
            ContentType="text/html",
        )


if __name__ == "__main__":
    import sys
    args = sys.argv[1:]
    stack_name = args[0] if len(args) >= 1 else os.getenv("STACK_NAME")
    assert stack_name
    now, html = asyncio.run(generate_status_report(stack_name))
    print(html)
