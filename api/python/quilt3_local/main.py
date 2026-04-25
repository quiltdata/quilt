from __future__ import annotations

import os
from contextlib import asynccontextmanager
from typing import Any

import fastapi
import starlette.responses
import starlette.staticfiles

from ._upstream import resource_path
from .api import api
from .lambdas import lambdas
from .s3proxy import s3proxy

REG_PREFIX = "/__reg"
LAMBDA_PREFIX = "/__lambda"
S3_PROXY_PREFIX = "/__s3proxy"
CATALOG_BUNDLE = os.getenv("QUILT_CATALOG_BUNDLE")
CATALOG_URL = os.getenv("QUILT_CATALOG_URL")
proxy_context: Any = None


@asynccontextmanager
async def lifespan(_app: fastapi.FastAPI):
    try:
        yield
    finally:
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
        "mixpanelToken": "",
        "mode": "LOCAL",
        "noDownload": False,
        "oktaBaseUrl": "",
        "oktaClientId": "",
        "oneLoginBaseUrl": "",
        "oneLoginClientId": "",
        "passwordAuth": "DISABLED",
        "registryUrl": REG_PREFIX,
        "s3Proxy": S3_PROXY_PREFIX,
        "sentryDSN": "",
        "serviceBucket": "",
        "signInRedirect": "/",
        "signOutRedirect": "/",
        "ssoAuth": "DISABLED",
        "ssoProviders": "",
    }


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
