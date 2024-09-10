import typing as T

from . import exceptions, types, util


def list(bucket_name: str) -> list[types.TabulatorTable]:
    """
    List all tabulator tables in a bucket.
    """
    result = util.get_client().bucket_tabulator_tables_list(bucket_name)
    if result is None:
        raise exceptions.BucketNotFoundError
    return [types.TabulatorTable(**x.model_dump()) for x in result.tabulator_tables]


def set(bucket_name: str, table_name: str, config: T.Optional[str]) -> None:
    """
    Set the tabulator table configuration. Pass `None` to remove the table.
    """
    result = util.get_client().bucket_tabulator_table_set(bucket_name, table_name, config)
    util.handle_errors(result)
