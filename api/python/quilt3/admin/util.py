from . import _graphql_client, exceptions, types


def handle_errors(result: _graphql_client.BaseModel) -> _graphql_client.BaseModel:
    if isinstance(result, (_graphql_client.InvalidInputSelection, _graphql_client.OperationErrorSelection)):
        raise exceptions.Quilt3AdminError(result)
    return result


def handle_user_mutation(result: _graphql_client.BaseModel) -> types.User:
    return types.User(**handle_errors(result).model_dump())


def get_client():
    return _graphql_client.Client()
