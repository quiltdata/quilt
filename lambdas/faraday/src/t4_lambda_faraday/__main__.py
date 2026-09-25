"""Run the exact Lambda event contract locally: python -m t4_lambda_faraday."""

import argparse
import contextlib
import json
import sys
from pathlib import Path

from . import lambda_handler


def main(argv=None):
    parser = argparse.ArgumentParser(description="Run Faraday using a Quilt package as its session")
    parser.add_argument("action", choices=("init", "run"))
    parser.add_argument("--registry", required=True, help="Session package registry, e.g. s3://my-bucket")
    parser.add_argument("--session", required=True, help="Package name, e.g. faraday/my-session")
    parser.add_argument("--agents", type=Path, help="AGENTS.md to use for init")
    parser.add_argument("--task", help="Task for run")
    args = parser.parse_args(argv)
    event = {"action": args.action, "session": {"registry": args.registry, "package": args.session}}
    if args.agents:
        event["agents"] = args.agents.read_text(encoding="utf-8")
    if args.task is not None:
        event["task"] = args.task
    # Quilt's progress output belongs on stderr; stdout is a single JSON result.
    with contextlib.redirect_stdout(sys.stderr):
        result = lambda_handler(event, None)
    print(json.dumps(result, indent=2))
    return 0 if result["status"] in ("ready", "completed") else 1


if __name__ == "__main__":
    sys.exit(main())
