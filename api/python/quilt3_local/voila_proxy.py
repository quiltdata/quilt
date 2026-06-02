"""
Dedicated HTTP + WebSocket proxy for LOCAL-mode Voila.

This is intentionally NOT the /__lambda HTTP-only proxy (lambdas/__init__.py):
Voila needs WebSockets for live kernel channels. We build an asgiproxy app
(make_simple_proxy_app drives both proxy_http streaming and proxy_websocket
bridging) wrapped in a small ASGI shim that implements the availability boundary:

  * GET /__reg/voila/  -> 200 when manager.is_ready(), else 404 (the catalog
    health probe in catalog/app/utils/voila.ts treats resp.ok as availability).
  * everything else    -> proxied to the live voila process (HTTP + WS),
    preserving the /__reg/voila prefix so it lines up with
    --Voila.base_url=/__reg/voila/.

The proxy is only mounted by main.py when voila_available() is True (the opt-in
flag AND the local-voila extra installed); when disabled, /__reg/voila/ falls
through to api.py's 404 stub.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Callable

from asgiproxy.config import BaseURLProxyConfigMixin, ProxyConfig
from asgiproxy.context import ProxyContext
from asgiproxy.simple_proxy import make_simple_proxy_app
from starlette.responses import JSONResponse, Response
from starlette.types import Receive, Scope, Send

if TYPE_CHECKING:
    from .voila_subprocess import VoilaManager

logger = logging.getLogger(__name__)

MOUNT_PATH = "/__reg/voila"
HEALTH_PATH = "/__reg/voila/"
_NOT_AVAILABLE_DETAIL = (
    "Voila dashboards are not implemented in LOCAL mode; installing the Python package alone is insufficient."
)


class VoilaProxyConfig(BaseURLProxyConfigMixin, ProxyConfig):
    """Per-request upstream resolution against the manager's live port.

    Starlette Mount at /__reg/voila leaves scope['path'] as the FULL
    '/__reg/voila/...' (it sets root_path but does not strip path), so we build
    the upstream URL directly from scope['path'] to preserve the prefix and line
    up with --Voila.base_url=/__reg/voila/.
    """

    # Unused (we override get_upstream_url), but the mixin declares it.
    upstream_base_url = "http://127.0.0.1"
    rewrite_host_header = None

    def __init__(self, get_manager: Callable[[], VoilaManager]) -> None:
        self._get_manager = get_manager

    def get_upstream_url(self, *, scope: Scope) -> str:
        manager = self._get_manager()
        port = manager.get_port()
        return f"http://127.0.0.1:{port}{scope['path']}"


def make_voila_proxy_app(
    get_manager: Callable[[], VoilaManager],
):
    """Return (asgi_app, ProxyContext) for the /__reg/voila mount.

    The manager is looked up lazily per request via get_manager (it is not built
    until lifespan runs), so this must never capture the manager at mount time.
    """
    config = VoilaProxyConfig(get_manager=get_manager)
    proxy_context = ProxyContext(config)
    proxy_app = make_simple_proxy_app(proxy_context)

    def _manager():
        try:
            return get_manager()
        except Exception:  # noqa: BLE001 - manager may not be ready on app.state yet
            return None

    async def app(scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "lifespan":
            # Mounted sub-app; the parent app owns lifespan/cleanup.
            return None

        if scope["type"] == "http":
            manager = _manager()
            ready = bool(manager is not None and manager.is_ready())
            path = scope.get("path", "")

            # Health probe and any request while not ready: short-circuit.
            if path == HEALTH_PATH and ready:
                response: Response = JSONResponse({"status": "ok"})
                return await response(scope, receive, send)

            if not ready:
                response = JSONResponse({"detail": _NOT_AVAILABLE_DETAIL}, status_code=404)
                return await response(scope, receive, send)

            return await proxy_app(scope, receive, send)

        if scope["type"] == "websocket":
            manager = _manager()
            if manager is None or not manager.is_ready():
                # Reject the upgrade; nothing upstream to bridge to.
                await send({"type": "websocket.close", "code": 1011})
                return None
            return await proxy_app(scope, receive, send)

        raise NotImplementedError(f"Scope {scope} is not understood")

    return app, proxy_context
