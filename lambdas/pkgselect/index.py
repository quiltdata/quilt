"""
Provide a virtual-file-system view of a package's logical keys.
"""

import asyncio
import dataclasses
import functools
import json
import typing as T

import boto3
import pandas as pd

from t4_lambda_shared.utils import query_manifest_content, sql_escape


async def run_async(fn, executor=None, loop=None):
    if loop is None:
        loop = asyncio.get_running_loop()
    return await loop.run_in_executor(executor, fn)


class PkgselectException(Exception):
    def __str__(self):
        s = self.__class__.__name__
        if self.args:
            s = f"{s}: {self.args[0]}"
        return s


class BadInputParameters(PkgselectException):
    pass


class AccessDenied(PkgselectException):
    pass


class NotFound(PkgselectException):
    pass


def validate(condition: T.Any, message: str):
    if not condition:
        raise BadInputParameters(message)


def file_list_to_folder(df: pd.DataFrame, limit: int, offset: int) -> dict:
    """
    Post process a set of logical keys to return only the top-level folder view.
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
        # df might not have the expected columns if either:
        # (1) the package is empty (has zero package entries) or,
        # (2) zero package entries match the prefix filter.
        # In either case, the folder view is empty.
        prefixes = []
        objects = []
        total_results = 0

    return dict(
        total=total_results,
        prefixes=prefixes,
        objects=objects,
    )


@functools.lru_cache(maxsize=None)
def get_s3_client():
    return boto3.client("s3")


async def select(bucket: str, key: str, stmt: str):
    s3 = get_s3_client()
    try:
        return await run_async(functools.partial(
            query_manifest_content,
            s3,
            bucket=bucket,
            key=key,
            sql_stmt=stmt,
        ))
    except (s3.exceptions.NoSuchKey, s3.exceptions.NoSuchBucket):
        raise NotFound
    except s3.exceptions.ClientError as ex:
        if ex.response.get("Error", {}).get("Code") == "AccessDenied":
            raise AccessDenied
        raise ex


async def select_meta(bucket: str, manifest: str, path: T.Optional[str] = None) -> dict:
    """
    Fetch package-level, directory-level or object-level metadata
    """
    if path:
        sql_stmt = f"SELECT s.meta FROM s3object s WHERE s.logical_key = '{sql_escape(path)}' LIMIT 1"
    else:
        sql_stmt = "SELECT s.* FROM s3object s WHERE s.logical_key is NULL LIMIT 1"

    result = await select(bucket, manifest, sql_stmt)
    return json.load(result) if result else {}


@dataclasses.dataclass
class FileView:
    physical_key: str
    size: int
    hash: str
    meta: T.Optional[dict]


async def file_view(bucket: str, manifest: str, path: str) -> T.Optional[FileView]:
    """
    Get details of a single file in the package.
    """
    validate(
        isinstance(bucket, str) and bucket,
        f"file_view: bucket must be a non-empty string (given: {bucket!r})",
    )
    validate(
        isinstance(manifest, str) and manifest,
        f"file_view: manifest must be a non-empty string (given: {manifest!r})",
    )
    validate(
        isinstance(path, str) and path,
        f"file_view: path must be a non-empty string (given: {path!r})",
    )

    details = await select(
        bucket,
        manifest,
        f"""
        SELECT s.physical_keys[0] as physical_key, s."size", s.hash."value" as hash, s.meta
        FROM s3object s
        WHERE s.logical_key = '{sql_escape(path)}'
        LIMIT 1
        """,
    )
    return FileView(**json.load(details)) if details is not None else None


@dataclasses.dataclass
class DirView:
    total: int
    prefixes: T.List[dict]  # {logical_key: str, size: float}
    objects: T.List[dict]  # {logical_key: str, size: float, physical_key: str}
    meta: dict


async def dir_view(
    bucket: str,
    manifest: str,
    path: T.Optional[str],
    limit: T.Optional[int] = None,
    offset: T.Optional[int] = None,
) -> DirView:
    validate(
        isinstance(bucket, str) and bucket,
        f"dir_view: bucket must be a non-empty string (given: {bucket!r})",
    )
    validate(
        isinstance(manifest, str) and manifest,
        f"dir_view: manifest must be a non-empty string (given: {manifest!r})",
    )
    validate(
        path is None or isinstance(path, str),
        f"dir_view: path must be a string if provided (given: {path!r})",
    )
    validate(
        limit is None or isinstance(limit, int) and limit > 0,
        f"dir_view: limit must be a positive int if provided (given: {limit!r})",
    )
    validate(
        offset is None or isinstance(offset, int) and offset >= 0,
        f"dir_view: offset must be a non-negative int if provided (given: {offset!r})",
    )

    if limit is None:
        limit = 1000
    if offset is None:
        offset = 0

    meta = asyncio.create_task(select_meta(bucket, manifest, path))

    # Call s3 select to fetch only logical keys matching the desired prefix (folder path)
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

    result = await select(bucket, manifest, sql_stmt)

    # Parse the response into a logical folder view
    if result is not None:
        df = pd.read_json(
            result,
            lines=True,
            dtype=dict(logical_key="string", physical_key="string"),
        )
    else:
        df = pd.DataFrame()

    return DirView(
        **file_list_to_folder(df, limit, offset),
        meta=await meta,
    )


actions = {
    "file": file_view,
    "dir": dir_view,
}


def lambda_handler(evt, _ctx):
    """
    Parse a manifest to return a folder-like view of its contents (logical keys).
    Payload format:
        bucket: str
        manifest: str
        action: see actions mapping
        params: see *_view functions
    Returns: {result} or {error} (see *_view functions for result format)
    """
    try:
        action = evt.get("action")
        validate(
            action in actions,
            f"action must be one of: {', '.join(actions)} (given: {action!r})",
        )

        result = asyncio.run(actions[action](
            evt.get("bucket"),
            evt.get("manifest"),
            **evt.get("params", {}),
        ))
        return {"result": dataclasses.asdict(result) if result is not None else None}

    except PkgselectException as ex:
        return {"error": str(ex)}
