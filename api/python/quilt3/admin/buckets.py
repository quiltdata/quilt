import typing as T

from . import _graphql_client, exceptions, types, util


def get(name: str) -> T.Optional[types.Bucket]:
    """
    Get a specific bucket configuration from the registry.
    Returns `None` if the bucket does not exist.

    Args:
        name: Name of the bucket to get.
    """
    result = util.get_client().bucket_get(name=name)
    if result is None:
        return None
    return types.Bucket(**result.model_dump())


def list() -> list[types.Bucket]:
    """
    List all bucket configurations in the registry.
    """
    return [types.Bucket(**b.model_dump()) for b in util.get_client().buckets_list()]


def add(
    name: str,
    title: str,
    *,
    description: T.Optional[str] = None,
    icon_url: T.Optional[str] = None,
    overview_url: T.Optional[str] = None,
    tags: T.Optional[T.List[str]] = None,
    relevance_score: T.Optional[int] = None,
    sns_notification_arn: T.Optional[str] = None,
    scanner_parallel_shards_depth: T.Optional[int] = None,
    skip_meta_data_indexing: T.Optional[bool] = None,
    file_extensions_to_index: T.Optional[T.List[str]] = None,
    index_content_bytes: T.Optional[int] = None,
    delay_scan: T.Optional[bool] = None,
    browsable: T.Optional[bool] = None,
    prefixes: T.Optional[T.List[str]] = None,
) -> types.Bucket:
    """
    Add a new bucket to the registry.

    Args:
        name: S3 bucket name.
        title: Display title for the bucket.
        description: Optional description.
        icon_url: Optional URL for bucket icon.
        overview_url: Optional URL for bucket overview page.
        tags: Optional list of tags.
        relevance_score: Optional relevance score for search ranking.
        sns_notification_arn: Optional SNS topic ARN for notifications.
        scanner_parallel_shards_depth: Optional depth for parallel scanning.
        skip_meta_data_indexing: If True, skip metadata indexing.
        file_extensions_to_index: Optional list of file extensions to index content.
        index_content_bytes: Optional max bytes of content to index.
        delay_scan: If True, delay initial bucket scan.
        browsable: If True, bucket is browsable.
        prefixes: Optional list of S3 prefixes to scope bucket access to.
            If provided, only these prefixes will be indexed and verified for access.
    """
    result = util.get_client().bucket_add(
        input=_graphql_client.BucketAddInput(
            name=name,
            title=title,
            description=description,
            icon_url=icon_url,
            overview_url=overview_url,
            tags=tags,
            relevance_score=relevance_score,
            sns_notification_arn=sns_notification_arn,
            scanner_parallel_shards_depth=scanner_parallel_shards_depth,
            skip_meta_data_indexing=skip_meta_data_indexing,
            file_extensions_to_index=file_extensions_to_index,
            index_content_bytes=index_content_bytes,
            delay_scan=delay_scan,
            browsable=browsable,
            prefixes=prefixes,
        )
    )
    return _handle_bucket_add_result(result)


def _handle_bucket_add_result(result) -> types.Bucket:
    """Handle bucket add mutation result."""
    if isinstance(result, _graphql_client.BucketAddBucketAddBucketAddSuccess):
        return types.Bucket(**result.bucket_config.model_dump())
    if isinstance(result, _graphql_client.BucketAddBucketAddBucketAlreadyAdded):
        raise exceptions.Quilt3AdminError("Bucket already added")
    if isinstance(result, _graphql_client.BucketAddBucketAddBucketDoesNotExist):
        raise exceptions.Quilt3AdminError("Bucket does not exist in S3")
    if isinstance(result, _graphql_client.BucketAddBucketAddInsufficientPermissions):
        raise exceptions.Quilt3AdminError(result.message)
    if isinstance(result, _graphql_client.BucketAddBucketAddSnsInvalid):
        raise exceptions.Quilt3AdminError("Invalid SNS notification ARN")
    if isinstance(result, _graphql_client.BucketAddBucketAddNotificationConfigurationError):
        raise exceptions.Quilt3AdminError("Notification configuration error")
    if isinstance(result, _graphql_client.BucketAddBucketAddNotificationTopicNotFound):
        raise exceptions.Quilt3AdminError("Notification topic not found")
    if isinstance(result, _graphql_client.BucketAddBucketAddBucketFileExtensionsToIndexInvalid):
        raise exceptions.Quilt3AdminError("Invalid file extensions to index")
    if isinstance(result, _graphql_client.BucketAddBucketAddBucketIndexContentBytesInvalid):
        raise exceptions.Quilt3AdminError("Invalid index content bytes")
    if isinstance(result, _graphql_client.BucketAddBucketAddSubscriptionInvalid):
        raise exceptions.Quilt3AdminError("Invalid subscription")
    raise exceptions.Quilt3AdminError(f"Unknown error: {result}")


def update(
    name: str,
    title: str,
    *,
    description: T.Optional[str] = None,
    icon_url: T.Optional[str] = None,
    overview_url: T.Optional[str] = None,
    tags: T.Optional[T.List[str]] = None,
    relevance_score: T.Optional[int] = None,
    sns_notification_arn: T.Optional[str] = None,
    scanner_parallel_shards_depth: T.Optional[int] = None,
    skip_meta_data_indexing: T.Optional[bool] = None,
    file_extensions_to_index: T.Optional[T.List[str]] = None,
    index_content_bytes: T.Optional[int] = None,
    browsable: T.Optional[bool] = None,
    prefixes: T.Optional[T.List[str]] = None,
) -> types.Bucket:
    """
    Update an existing bucket configuration.

    Args:
        name: S3 bucket name.
        title: Display title for the bucket.
        description: Optional description.
        icon_url: Optional URL for bucket icon.
        overview_url: Optional URL for bucket overview page.
        tags: Optional list of tags.
        relevance_score: Optional relevance score for search ranking.
        sns_notification_arn: Optional SNS topic ARN for notifications.
        scanner_parallel_shards_depth: Optional depth for parallel scanning.
        skip_meta_data_indexing: If True, skip metadata indexing.
        file_extensions_to_index: Optional list of file extensions to index content.
        index_content_bytes: Optional max bytes of content to index.
        browsable: If True, bucket is browsable.
        prefixes: Optional list of S3 prefixes to scope bucket access to.
            If provided, only these prefixes will be indexed and verified for access.
            Changing prefixes will trigger permission re-verification.
    """
    result = util.get_client().bucket_update(
        name=name,
        input=_graphql_client.BucketUpdateInput(
            title=title,
            description=description,
            icon_url=icon_url,
            overview_url=overview_url,
            tags=tags,
            relevance_score=relevance_score,
            sns_notification_arn=sns_notification_arn,
            scanner_parallel_shards_depth=scanner_parallel_shards_depth,
            skip_meta_data_indexing=skip_meta_data_indexing,
            file_extensions_to_index=file_extensions_to_index,
            index_content_bytes=index_content_bytes,
            browsable=browsable,
            prefixes=prefixes,
        ),
    )
    return _handle_bucket_update_result(result)


def _handle_bucket_update_result(result) -> types.Bucket:
    """Handle bucket update mutation result."""
    if isinstance(result, _graphql_client.BucketUpdateBucketUpdateBucketUpdateSuccess):
        return types.Bucket(**result.bucket_config.model_dump())
    if isinstance(result, _graphql_client.BucketUpdateBucketUpdateBucketNotFound):
        raise exceptions.BucketNotFoundError()
    if isinstance(result, _graphql_client.BucketUpdateBucketUpdateInsufficientPermissions):
        raise exceptions.Quilt3AdminError(result.message)
    if isinstance(result, _graphql_client.BucketUpdateBucketUpdateSnsInvalid):
        raise exceptions.Quilt3AdminError("Invalid SNS notification ARN")
    if isinstance(result, _graphql_client.BucketUpdateBucketUpdateNotificationConfigurationError):
        raise exceptions.Quilt3AdminError("Notification configuration error")
    if isinstance(result, _graphql_client.BucketUpdateBucketUpdateNotificationTopicNotFound):
        raise exceptions.Quilt3AdminError("Notification topic not found")
    if isinstance(result, _graphql_client.BucketUpdateBucketUpdateBucketFileExtensionsToIndexInvalid):
        raise exceptions.Quilt3AdminError("Invalid file extensions to index")
    if isinstance(result, _graphql_client.BucketUpdateBucketUpdateBucketIndexContentBytesInvalid):
        raise exceptions.Quilt3AdminError("Invalid index content bytes")
    raise exceptions.Quilt3AdminError(f"Unknown error: {result}")


def remove(name: str) -> None:
    """
    Remove a bucket from the registry.

    Args:
        name: Name of the bucket to remove.
    """
    result = util.get_client().bucket_remove(name=name)
    _handle_bucket_remove_result(result)


def _handle_bucket_remove_result(result) -> None:
    """Handle bucket remove mutation result."""
    if isinstance(result, _graphql_client.BucketRemoveBucketRemoveBucketRemoveSuccess):
        return
    if isinstance(result, _graphql_client.BucketRemoveBucketRemoveBucketNotFound):
        raise exceptions.BucketNotFoundError()
    if isinstance(result, _graphql_client.BucketRemoveBucketRemoveIndexingInProgress):
        raise exceptions.Quilt3AdminError("Cannot remove bucket while indexing is in progress")
    raise exceptions.Quilt3AdminError(f"Unknown error: {result}")
