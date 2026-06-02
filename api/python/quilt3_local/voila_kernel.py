"""
Custom Jupyter MultiKernelManager for LOCAL-mode Voila.

Voila is ONE shared server that spawns a fresh kernel per render request. This
manager scopes the per-session env (AWS credentials + QUILT_PKG_*) to the
kernel-creating request, on top of the LOCAL backend env inherited from the
parent voila process. Wired via:

    --VoilaConfiguration.multi_kernel_manager_class=quilt3_local.voila_kernel.QuiltKernelManager

This module is imported INSIDE the Voila process (the backend env with the
opt-in `local-voila` extra), so it imports jupyter_server lazily at
class-definition time only when available.
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

# Mapping of incoming render query params -> kernel env vars.
# Duplicated from voila_subprocess.translate_render_params so this module stays
# importable inside the isolated voila env without importing the parent package.
_PARAM_TO_ENV = {
    "pkg_bucket": "QUILT_PKG_BUCKET",
    "pkg_name": "QUILT_PKG_NAME",
    "pkg_top_hash": "QUILT_PKG_TOP_HASH",
    "access_key": "AWS_ACCESS_KEY_ID",
    "secret_key": "AWS_SECRET_ACCESS_KEY",
    "session_token": "AWS_SESSION_TOKEN",
}


def _translate(query: dict) -> dict[str, str]:
    """Translate (possibly multi-valued) tornado query args into kernel env."""
    env: dict[str, str] = {}
    for src, dst in _PARAM_TO_ENV.items():
        value = query.get(src)
        if isinstance(value, (list, tuple)):
            value = value[0] if value else None
        if isinstance(value, bytes):
            value = value.decode("utf-8", "replace")
        if value:
            env[dst] = value
    return env


try:  # pragma: no cover - exercised only inside the isolated voila env
    from voila.execution import VoilaKernelManager as _BaseKernelManager
except Exception:  # noqa: BLE001 - voila may not expose this symbol in all versions
    try:
        from jupyter_server.services.kernels.kernelmanager import MappingKernelManager as _BaseKernelManager
    except Exception:  # noqa: BLE001
        _BaseKernelManager = None  # type: ignore[assignment]


if _BaseKernelManager is not None:

    class QuiltKernelManager(_BaseKernelManager):  # type: ignore[valid-type,misc]
        """Inject per-session credential/pkg env into each spawned kernel."""

        def _current_request_env(self) -> dict[str, str]:
            """Read the env for the render request that is creating this kernel.

            Voila stashes the current handler/request; we read its query args so
            credentials/pkg are scoped per render request and never bleed across
            sessions. Falls back to an empty dict when no request context exists.
            """
            try:
                from voila.utils import get_query_string  # type: ignore

                query = get_query_string()  # voila >=0.5 helper
                if query:
                    from urllib.parse import parse_qs

                    return _translate(parse_qs(query))
            except Exception:  # noqa: BLE001
                pass
            return {}

        def pre_start_kernel(self, kernel_name, kwargs):  # type: ignore[override]
            env = dict(kwargs.get("env") or {})
            env.update(self._current_request_env())
            kwargs["env"] = env
            return super().pre_start_kernel(kernel_name, kwargs)

else:  # pragma: no cover - import-time guard for environments without jupyter

    class QuiltKernelManager:  # type: ignore[no-redef]
        def __init__(self, *args, **kwargs):
            raise RuntimeError("QuiltKernelManager requires voila/jupyter-server; install the 'local-voila' extra.")
