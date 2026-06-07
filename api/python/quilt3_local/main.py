from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from typing import Any

import fastapi
import starlette.responses
import starlette.staticfiles

from ._upstream import resource_path
from .api import api
from .lambda_subprocess import LAMBDA_CONFIGS, LambdaManager, detect_repo_root
from .lambdas import close_client as close_lambda_client, lambdas
from .s3proxy import s3proxy
from .settings import local_origin, voila_notebook_dir
from .voila_subprocess import VoilaManager, voila_available

logger = logging.getLogger(__name__)

REG_PREFIX = "/__reg"
LAMBDA_PREFIX = "/__lambda"
S3_PROXY_PREFIX = "/__s3proxy"
CATALOG_BUNDLE = os.getenv("QUILT_CATALOG_BUNDLE")
CATALOG_URL = os.getenv("QUILT_CATALOG_URL")
proxy_context: Any = None
voila_proxy_context: Any = None


@asynccontextmanager
async def lifespan(_app: fastapi.FastAPI):
    repo_root = detect_repo_root()
    s3_proxy_origin = f"{local_origin()}{S3_PROXY_PREFIX}"
    manager = LambdaManager(configs=LAMBDA_CONFIGS, repo_root=repo_root, s3_proxy_origin=s3_proxy_origin)
    await manager.start_all()
    _app.state.lambda_manager = manager
    lambdas.state.lambda_manager = manager

    voila_manager: VoilaManager | None = None
    if voila_available():
        try:
            voila_manager = VoilaManager(
                repo_root=repo_root,
                notebook_dir=voila_notebook_dir(),
                base_url=f"{REG_PREFIX}/voila/",
            )
            await voila_manager.start_all()
        except Exception:
            # Voila failure must never block the catalog.
            logger.exception("Failed to start Voila; continuing without it.")
            voila_manager = None
    _app.state.voila_manager = voila_manager

    try:
        yield
    finally:
        await manager.stop_all()
        await close_lambda_client()
        if voila_manager is not None:
            try:
                await voila_manager.stop_all()
            except Exception:
                logger.exception("Error stopping Voila manager.")
        if voila_proxy_context is not None:
            await voila_proxy_context.close()
        if proxy_context is not None:
            await proxy_context.close()


app = fastapi.FastAPI(lifespan=lifespan)


class SPA(starlette.staticfiles.StaticFiles):
    def __init__(self, directory: str | os.PathLike[str] | None = None, index: str = "index.html") -> None:
        self.index = index
        if not directory:
            directory = resource_path("catalog_bundle")
        super().__init__(directory=directory, packages=None, html=True, check_dir=True)

    def lookup_path(self, path: str) -> tuple[str, os.stat_result | None]:
        full_path, stat_result = super().lookup_path(path)
        if stat_result is None:
            return super().lookup_path(self.index)
        return full_path, stat_result


@app.get("/config.json")
def config():
    return {
        "alwaysRequiresAuth": False,
        "analyticsBucket": "",
        "apiGatewayEndpoint": LAMBDA_PREFIX,
        "binaryApiGatewayEndpoint": LAMBDA_PREFIX,
        "googleClientId": "",
        "hubspotId": "",
        "intercomAppId": "",
        "mixpanelToken": "",
        "mode": "LOCAL",
        "noDownload": False,
        "noOverviewImages": False,
        "oktaBaseUrl": "",
        "oktaClientId": "",
        "oneLoginBaseUrl": "",
        "oneLoginClientId": "",
        "packageRoot": "",
        "passwordAuth": "DISABLED",
        "qurator": False,
        "quratorDefaultModel": "",
        "region": "us-east-1",
        "registryUrl": REG_PREFIX,
        "s3Proxy": S3_PROXY_PREFIX,
        "sentryDSN": "",
        "serviceBucket": "",
        "signInRedirect": "/",
        "signOutRedirect": "/",
        "ssoAuth": "DISABLED",
        "ssoProviders": "",
        "stackVersion": "local-dev",
    }


# Order matters: mount the Voila proxy BEFORE the /__reg api mount. Starlette
# matches mounts in registration order, so the longer prefix registered first
# intercepts /__reg/voila/* before it reaches the api sub-app's 404 stub.
# Only mounted when voila_available(); otherwise requests fall through to that
# stub (graceful disable).
if voila_available():
    app.state.voila_manager = None
    from .voila_proxy import make_voila_proxy_app

    voila_proxy_app, voila_proxy_context = make_voila_proxy_app(get_manager=lambda: app.state.voila_manager)
    app.mount("/__reg/voila", voila_proxy_app, "Voila")

app.mount(REG_PREFIX, api, "API")
app.mount(LAMBDA_PREFIX, lambdas, "Lambda")
app.mount(S3_PROXY_PREFIX, s3proxy, "S3 Proxy")

if CATALOG_URL:

    @app.get("/__webpack_hmr")
    def webpack_hmr():
        return starlette.responses.Response(status_code=404)

    from asgiproxy.__main__ import make_app as make_proxy_app

    proxy_app, proxy_context = make_proxy_app(upstream_base_url=CATALOG_URL)
    app.mount("/", proxy_app, "SPAProxy")

else:
    app.mount("/", SPA(directory=CATALOG_BUNDLE), "SPA")


def run():
    try:
        import uvicorn
    except ImportError:
        print("Please install uvicorn to run a development server.")
        import sys

        sys.exit(0)

    uvicorn.run("quilt3_local.main:app", port=int(os.getenv("PORT", "3000")), reload=True)
