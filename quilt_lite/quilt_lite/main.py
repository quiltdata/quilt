import typing as T
import os

import fastapi
import starlette.staticfiles
import quilt3

from .api import api

REG_PREFIX = "/__reg"
CATALOG_BUNDLE = "../catalog/build"

open_config = quilt3.api._config()

app = fastapi.FastAPI()


# TODO: support proxying to local catalog server for easier development
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
app.mount("/", SPA(directory=CATALOG_BUNDLE), "SPA")
