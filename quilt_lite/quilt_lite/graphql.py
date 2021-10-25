import ariadne
import importlib_resources


# TODO: load schema from a public shared folder
with importlib_resources.path('quilt_lite', 'schema.graphql') as schema_path:
    type_defs = ariadne.load_schema_from_path(str(schema_path))

query = ariadne.QueryType()

@query.field("bucketConfigs")
def query_bucket_configs(*_):
    return []

@query.field("bucketConfig")
def query_bucket_config(*_, name):
    return None

schema = ariadne.make_executable_schema(type_defs, query)
