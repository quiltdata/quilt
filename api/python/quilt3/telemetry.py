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

DISABLE_USAGE_METRICS_ENVVAR = "QUILT_DISABLE_USAGE_METRICS"
MAX_CLEANUP_WAIT_SECS = 5


@functools.lru_cache(maxsize=None)
def get_session_id():
    return str(uuid.uuid4())


reset_session_id = get_session_id.cache_clear


class TelemetryClient:
    endpoint = "https://telemetry.quiltdata.cloud/Prod/metrics"
    user_agent = "QuiltCli"
    client_type = "quilt3-python-client"
    schema_version = "pyclient-usage-metrics-v1"

    @classmethod
    def create_session(cls):
        return FuturesSession(executor=ThreadPoolExecutor(max_workers=2))

    def __init__(self):
        self.session = self.create_session()
        self.pending_reqs = []
        self.pending_reqs_lock = Lock()
        atexit.register(self.cleanup)

    def report_api_use(self, api_name):
        navigator_url = get_from_config("navigator_url")
        data = {
            "api_name": api_name,
            "python_session_id": get_session_id(),
            "telemetry_schema_version": self.schema_version,
            "navigator_url": navigator_url,
            'client_type': self.client_type,
            'client_version': quilt3_version,
            'platform': sys.platform,
            'python_implementation': platform.python_implementation(),
            'python_version_major': platform.python_version_tuple()[0],
            'python_version_minor': platform.python_version_tuple()[1],
            'python_version_patch': platform.python_version_tuple()[2]
        }
        # print(f"Sending data: {data}")
        with self.pending_reqs_lock:
            # Take this opportunity to clean up any completed requests so that list never gets too large.
            # Might be better to use a done callback
            # - https://docs.python.org/3/library/concurrent.futures.html#concurrent.futures.Future.add_done_callback
            self.pending_reqs = [r for r in self.pending_reqs if not r.done()]
            r = self.session.post(self.endpoint, json=data, headers={'User-Agent': self.user_agent})
            self.pending_reqs.append(r)

    def cleanup(self):
        # Finish up any pending requests, but don't wait forever
        # t = Timer("cleanup").start()
        # print(f"Cleaning up {len(ApiTelemetry.pending_reqs)} pending requests...")
        with self.pending_reqs_lock:  # Not sure why we would need this lock...
            wait(self.pending_reqs, timeout=MAX_CLEANUP_WAIT_SECS)
        # t.stop()


class TelemetryClientProxy:
    client_cls = TelemetryClient

    @classmethod
    def check_disabled_in_config(cls):
        """
        Check if 'telemetry_disabled' field exists in quilt3 config. If it does, return it. If it does not exist, set
        it to default value of 'false' (to handle case of current users who predate this config field).
        """
        config_value = get_from_config("telemetry_disabled")
        if config_value is not None:
            return config_value

        set_config_value("telemetry_disabled", False)
        return False

    @classmethod
    def check_disabled_by_envvar(cls):
        envvar = os.environ.get(DISABLE_USAGE_METRICS_ENVVAR, "")
        if envvar.lower() in ("false", "no", "0"):
            return False
        return bool(envvar)

    @classmethod
    def is_disabled(cls):
        return (
            cls.check_disabled_in_config()
            or cls.check_disabled_by_envvar()
        )

    @staticmethod
    def _dummy_reporter(*args, **kwargs):
        pass

    @staticmethod
    def _get_configured_reporter():
        return

    def report_api_use(self, api_name):
        self.report_api_use = self._dummy_reporter if self.is_disabled() else self.client_cls().report_api_use
        return self.report_api_use(api_name)

    def disable(self):
        self.report_api_use = self._dummy_reporter


class ApiTelemetry:
    telemetry_client = TelemetryClientProxy()

    def __init__(self, api_name):
        self.api_name = api_name

    def __call__(self, func):
        @functools.wraps(func)
        def decorated(*args, **kwargs):
            self.telemetry_client.report_api_use(self.api_name)
            results = func(*args, **kwargs)
            # print(f"{len(ApiTelemetry.pending_reqs)} request(s) pending!")

            if self.api_name == "api.disable_telemetry":
                # Quick hack to disable telemetry immediately after the user calls disable_telemetry()
                # TODO(armand): This string matching is extremely brittle. Fix ASAP
                self.telemetry_client.disable()
            return results

        return decorated
