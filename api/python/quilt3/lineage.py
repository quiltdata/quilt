import functools

from openlineage import client as OL
# XXX: do we want to import everything explicitly?
from openlineage.client.facet import *
from openlineage.client.run import *

# from .telemetry import ApiTelemetry
# from .util import (
#     QuiltConfig,
#     QuiltException,
#     load_config,
# )

# TODO: use config value
OL_URL = "http://localhost:5001" # should be a route in the registry probably
# OL_PRODUCER = "quilt-dev"
# OL_NAMESPACE = "default"


@functools.lru_cache(maxsize=None)
def get_lineage_client():
    # XXX: use api key for authentication?
    return OL.OpenLineageClient(OL_URL)


# @ApiTelemetry("api.lineage.post")
def post(event: RunEvent):
    # XXX: fail when no lineage endpoint configured?
    get_lineage_client().emit(event)


# TODO: quilt-specific facets
