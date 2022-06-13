import atexit
import functools
import os
import platform
import sys
import uuid
from concurrent.futures import ThreadPoolExecutor, wait
from threading import Lock

from requests_futures.sessions import FuturesSession

from . import __version__ as quilt3_version
from .util import get_from_config, set_config_value

TELEMETRY_URL = "https://telemetry.quiltdata.cloud/Prod/metrics"
TELEMETRY_USER_AGENT = "QuiltCli"
TELEMETRY_CLIENT_TYPE = "quilt3-python-client"
TELEMETRY_SCHEMA_VERSION = "pyclient-usage-metrics-v1"

DISABLE_USAGE_METRICS_ENVVAR = "QUILT_DISABLE_USAGE_METRICS"
MAX_CLEANUP_WAIT_SECS = 5


@functools.lru_cache(maxsize=None)
def get_session_id():
    return str(uuid.uuid4())


reset_session_id = get_session_id.cache_clear


class ApiTelemetry:
    session = None
    pending_reqs = []
    pending_reqs_lock = Lock()
    telemetry_disabled = None

    @classmethod
    def create_session(cls):
        return FuturesSession(executor=ThreadPoolExecutor(max_workers=2))  # pylint: disable=consider-using-with

    def __init__(self, api_name):
        if ApiTelemetry.telemetry_disabled is None:
            ApiTelemetry.telemetry_disabled = ApiTelemetry.telemetry_is_disabled()

        if ApiTelemetry.session is None:
            ApiTelemetry.session = ApiTelemetry.create_session()

        self.api_name = api_name

    @classmethod
    def has_connectivity(cls):
        # TODO: Implement this check. Punting for the near term
        return True

    @classmethod
    def check_telemetry_disabled_in_config(cls):
        """
        Check if 'telemetry_disabled' field exists in quilt3 config. If it does, return it. If it does not exist, set
        it to default value of 'false' (to handle case of current users who predate this config field).
        """
        config_value = get_from_config("telemetry_disabled")
        if config_value is not None:
            return config_value
        else:
            set_config_value("telemetry_disabled", False)
            return False

    @classmethod
    def check_telemetry_disabled_by_envvar(cls):
        envvar = os.environ.get(DISABLE_USAGE_METRICS_ENVVAR, "")
        if envvar.lower() in ("false", "no", "0"):
            return False
        return bool(envvar)

    @classmethod
    def telemetry_is_disabled(cls):
        disabled_via_config = ApiTelemetry.check_telemetry_disabled_in_config()
        disabled_via_envvar = ApiTelemetry.check_telemetry_disabled_by_envvar()
        disabled_due_to_no_connection = not ApiTelemetry.has_connectivity()

        if disabled_via_config:
            return True

        if disabled_via_envvar:
            return True

        if disabled_due_to_no_connection:
            return True

        return False

    @classmethod
    def cleanup_completed_requests(cls):
        if ApiTelemetry.telemetry_disabled:
            return

        # Take this opportunity to clean up any completed requests so that list never gets too large.
        # Might be better to use a done callback
        # - https://docs.python.org/3/library/concurrent.futures.html#concurrent.futures.Future.add_done_callback
        with ApiTelemetry.pending_reqs_lock:
            ApiTelemetry.pending_reqs = [r for r in ApiTelemetry.pending_reqs if not r.done()]

    @classmethod
    def report_api_use(cls, api_name, python_session_id):
        if ApiTelemetry.telemetry_disabled:
            return

        navigator_url = get_from_config("navigator_url")
        data = {
            "api_name": api_name,
            "python_session_id": python_session_id,
            "telemetry_schema_version": TELEMETRY_SCHEMA_VERSION,
            "navigator_url": navigator_url,
            'client_type': TELEMETRY_CLIENT_TYPE,
            'client_version': quilt3_version,
            'platform': sys.platform,
            'python_implementation': platform.python_implementation(),
            'python_version_major': platform.python_version_tuple()[0],
            'python_version_minor': platform.python_version_tuple()[1],
            'python_version_patch': platform.python_version_tuple()[2]
        }
        # print(f"Sending data: {data}")
        with ApiTelemetry.pending_reqs_lock:
            r = ApiTelemetry.session.post(TELEMETRY_URL, json=data, headers={'User-Agent': TELEMETRY_USER_AGENT})
            ApiTelemetry.pending_reqs.append(r)

    def __call__(self, func):
        @functools.wraps(func)
        def decorated(*args, **kwargs):

            ApiTelemetry.cleanup_completed_requests()
            ApiTelemetry.report_api_use(self.api_name, get_session_id())

            results = func(*args, **kwargs)
            # print(f"{len(ApiTelemetry.pending_reqs)} request(s) pending!")

            if self.api_name == "api.disable_telemetry":
                # Quick hack to disable telemetry immediately after the user calls disable_telemetry()
                # TODO(armand): This string matching is extremely brittle. Fix ASAP
                ApiTelemetry.telemetry_disabled = True
            return results

        return decorated


# Finish up any pending requests, but don't wait forever
@atexit.register
def cleanup():
    # t = Timer("cleanup").start()
    # print(f"Cleaning up {len(ApiTelemetry.pending_reqs)} pending requests...")
    with ApiTelemetry.pending_reqs_lock:  # Not sure why we would need this lock...
        wait(ApiTelemetry.pending_reqs, timeout=MAX_CLEANUP_WAIT_SECS)
    # t.stop()
