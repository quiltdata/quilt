import typing as T
import os

import fastapi
import starlette.staticfiles
import quilt3


from .api import api

REG_PREFIX = "/__reg"
CATALOG_BUNDLE = os.getenv("CATALOG_BUNDLE", "../catalog/build")
CATALOG_URL = os.getenv("CATALOG_URL")

open_config = quilt3.api._config()

app = fastapi.FastAPI()


class SPA(starlette.staticfiles.StaticFiles):
    def __init__(self, directory: os.PathLike, index='index.html') -> None:
        self.index = index
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
        "apiGatewayEndpoint": open_config["apiGatewayEndpoint"],
        "binaryApiGatewayEndpoint": open_config["binaryApiGatewayEndpoint"],
        "googleClientId": "",
        "mixpanelToken": "",
        "mode": "LOCAL",
        "noDownload": False, #?
        "oktaBaseUrl": "",
        "oktaClientId": "",
        "oneLoginBaseUrl": "",
        "oneLoginClientId": "",
        "passwordAuth": "DISABLED",
        "registryUrl": REG_PREFIX,
        "s3Proxy": open_config["s3Proxy"],
        "sentryDSN": "",
        "serviceBucket": "", #?
        "signInRedirect": "/", #?
        "signOutRedirect": "/", #?
        "ssoAuth": "DISABLED",
        "ssoProviders": "",
    }


app.mount(REG_PREFIX, api, "API")

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
