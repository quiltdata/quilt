from . import aws, context, settings

FILESYSTEM_BUCKET_DESCRIPTION = "Filesystem-backed LOCAL bucket"


def _filesystem_bucket_names() -> list[str]:
    root = settings.data_dir()
    if root is None or not root.exists():
        return []
    return sorted(entry.name for entry in root.iterdir() if entry.is_dir() and not entry.name.startswith("."))


def _bucket_config(bucket: str) -> dict:
    return {
        "name": bucket,
        "title": bucket,
        "iconUrl": None,
        "description": FILESYSTEM_BUCKET_DESCRIPTION if settings.filesystem_mode() else None,
        "linkedData": None,
        "overviewUrl": None,
        "tags": ["local"] if settings.filesystem_mode() else [],
        "relevanceScore": 100,
        "lastIndexed": None,
        "browsable": True,
        "snsNotificationArn": None,
        "scannerParallelShardsDepth": None,
        "skipMetaDataIndexing": None,
        "fileExtensionsToIndex": None,
        "indexContentBytes": None,
        "prefixes": [],
        "associatedPolicies": [],
        "associatedRoles": [],
        "collaborators": [],
        "tabulatorTables": [],
    }


async def list_bucket_configs() -> list[dict]:
    if settings.filesystem_mode():
        return [_bucket_config(bucket) for bucket in _filesystem_bucket_names()]
    return []


async def get_bucket_config(bucket: str) -> dict | None:
    if not await bucket_is_readable(bucket):
        return None
    return _bucket_config(bucket)


@context.cached
async def bucket_is_readable(bucket: str) -> bool:
    return await aws.bucket_exists(bucket)
