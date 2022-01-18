import os
import typing as T

import fastapi
import starlette.staticfiles

from .api import api
from .lambdas import lambdas
from .s3proxy import s3proxy

REG_PREFIX = "/__reg"
LAMBDA_PREFIX = "/__lambda"
S3_PROXY_PREFIX = "/__s3proxy"
CATALOG_BUNDLE = os.getenv("QUILT_CATALOG_BUNDLE")
CATALOG_URL = os.getenv("QUILT_CATALOG_URL")

app = fastapi.FastAPI()


class SPA(starlette.staticfiles.StaticFiles):
    def __init__(self, directory: T.Optional[os.PathLike] = None, index='index.html') -> None:
        self.index = index
        if not directory:
            directory = os.path.join(os.path.dirname(__file__), "catalog_bundle")
        super().__init__(directory=directory, packages=None, html=True, check_dir=True)

    async def lookup_path(self, path: str) -> T.Tuple[str, os.stat_result]:
        full_path, stat_result = await super().lookup_path(path)

        # return index if a file cannot be found
        if stat_result is None:
            return await super().lookup_path(self.index)

        return (full_path, stat_result)


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
        "noDownload": True,
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
    # to avoid long-polling connections preventing server restarts
    @app.get("/__webpack_hmr")
    def webpack_hmr():
        return starlette.responses.Response(status_code=404)

    from asgiproxy.__main__ import make_app as make_proxy_app

    proxy_app, proxy_context = make_proxy_app(upstream_base_url=CATALOG_URL)
    app.mount("/", proxy_app, "SPAProxy")

    @app.on_event("shutdown")
    async def on_shutdown():
        await proxy_context.close()

else:
    app.mount("/", SPA(directory=CATALOG_BUNDLE), "SPA")


def run():
    try:
        import uvicorn
    except ImportError:
        print("Please install uvicorn to run a development server.")
        import sys
        sys.exit(0)

    uvicorn.run(
        "quilt3_local.main:app",
        port=int(os.getenv("PORT", "3000")),
        reload=True,
    )
