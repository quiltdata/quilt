"""
Provide a virtual-file-system view of a package's logical keys.
"""

import functools
import json
import typing as T

import boto3
import pandas as pd

from .lambdas.shared.utils import query_manifest_content, sql_escape
from .run_async import run_async

s3 = boto3.client("s3")


def _file_list_to_folder(df: pd.DataFrame, limit: int, offset: int) -> dict:
    """
    Post process a set of logical keys to return only the
    top-level folder view (a special case of the s3-select
    lambda).
    """
    if {'physical_key', 'logical_key', 'size'}.issubset(df.columns):
        groups = df.groupby(df.logical_key.str.extract('([^/]+/?).*')[0], dropna=True)
        folder = groups.agg(
            size=('size', 'sum'),
            physical_key=('physical_key', 'first')
        )
        folder.reset_index(inplace=True)  # move the logical_key from the index to column[0]
        folder.rename(columns={0: 'logical_key'}, inplace=True)  # name the new column

        # Sort to ensure consistent paging
        folder.sort_values(by=['logical_key'], inplace=True)

        # Page response (folders and files) based on limit & offset
        total_results = len(folder.index)
        folder = folder.iloc[offset:offset+limit]

        # Do not return physical_key for prefixes
        prefixes = folder[folder.logical_key.str.contains('/')].drop(
            ['physical_key'],
            axis=1
        ).to_dict(orient='records')
        objects = folder[~folder.logical_key.str.contains('/')].to_dict(orient='records')
    else:
        # df might not have the expected columns if either: (1) the
        # package is empty (has zero package entries) or, (2) zero
        # package entries match the prefix filter. In either case,
        # the folder view is empty.
        prefixes = []
        objects = []
        total_results = 0

    return dict(
        total=total_results,
        prefixes=prefixes,
        objects=objects,
    )


def _bind_select(bucket: str, key: str):
    def select(sql_stmt: str):
        return run_async(functools.partial(
            query_manifest_content,
            s3,
            bucket=bucket,
            key=key,
            sql_stmt=sql_stmt,
        ))

    return select


async def _select_meta(select, path: T.Optional[str] = None) -> dict:
    """
    Fetch package-level, directory-level or object-level metadata
    """
    if path:
        sql_stmt = f"SELECT s.meta FROM s3object s WHERE s.logical_key = '{sql_escape(path)}'"
    else:
        sql_stmt = "SELECT s.* FROM s3object s WHERE s.logical_key is NULL"

    result = await select(sql_stmt)
    return json.load(result) if result else {}


async def _select_stats(select):
    result = await select(
        """
        SELECT SUM(s."size") as total_bytes, COUNT(s.logical_key) as total_files
        FROM s3object s
        WHERE s.logical_key is NOT NULL
        """,
    )
    return json.load(result) if result else {"total_files": 0, "total_bytes": 0}


async def select_root(bucket: str, manifest: str):
    """
    Returns { meta: dict, total_files: int, total_bytes: int }
    """
    select = _bind_select(bucket, manifest)
    stats = _select_stats(select)
    meta = _select_meta(select)
    return {
        "meta": await meta,
        **(await stats),
    }


async def select_file(bucket: str, manifest: str, path: str):
    """
    Get details of a single file in the package
    Returns { physical_key: str, size: int, hash: str, meta: dict | None }
    """
    select = _bind_select(bucket, manifest)
    details = await select(
        f"""
        SELECT s.physical_keys[0] as physical_key, s."size", s.hash."value" as hash, s.meta
        FROM s3object s
        WHERE s.logical_key = '{sql_escape(path)}'
        LIMIT 1
        """,
    )
    return json.load(details) if details is not None else None


async def select_dir(bucket: str, manifest: str, path: str, limit: int = None, offset: int = None):
    """
    Returns {
        total: int,
        prefixes: list[{ logical_key: str, size: float }],
        objects: list[{ logical_key: str, size: float, physical_key: str }],
        meta: dict,
    }
    """
    if limit is None:
        limit = 1000
    if offset is None:
        offset = 0

    select = _bind_select(bucket, manifest)

    meta = _select_meta(select, path)

    # Call s3 select to fetch only logical keys matching the
    # desired prefix (folder path)
    prefix_length = len(path) if path is not None else 0
    sql_stmt = \
        f"""
        SELECT
            SUBSTRING(s.logical_key, {prefix_length + 1}) as logical_key,
            s."size",
            s.physical_keys[0] as physical_key
        FROM s3object s
        """

    if path:
        sql_stmt += f" WHERE SUBSTRING(s.logical_key, 1, {prefix_length}) = '{sql_escape(path)}'"

    result = await select(sql_stmt)

    if result is None:
        return None

    # Parse the response into a logical folder view
    df = pd.read_json(
        result,
        lines=True,
        dtype=dict(logical_key="string", physical_key="string"),
    )

    return {
        **_file_list_to_folder(df, limit, offset),
        "meta": await meta,
    }
