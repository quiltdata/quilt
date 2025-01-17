
# get\_build\_s3\_client\_hook() -> Optional[quilt3.hooks.BuildClientHook]  {#get\_build\_s3\_client\_hook}

Return build S3 client hook.


# set\_build\_s3\_client\_hook(hook: Optional[quilt3.hooks.BuildClientHook]) -> Optional[quilt3.hooks.BuildClientHook]  {#set\_build\_s3\_client\_hook}

Set build S3 client hook.

Example for overriding `ServerSideEncryption` parameter for certain S3 operations:

```python
def event_handler(params, **kwargs):
    # Be mindful with parameters you set here.
    # Specifically we it's not recommended to override/delete already set parameters
    # because that can break quilt3 logic.
    params.setdefault("ServerSideEncryption", "AES256")

def hook(build_client_base, session, client_kwargs):
    client = build_client_base(session, client_kwargs)
    for op in (
        "CreateMultipartUpload",
        "CopyObject",
        "PutObject",
    ):
        client.meta.events.register(f"before-parameter-build.s3.{op}", event_handler)
    return client
```

__Arguments__

* __hook__:  Build client hook.

__Returns__

Old build client hook.

Examples:
```python
    >>> def hook(build_client_base, session, client_kwargs):
    ...     print("Building client")
    ...     return build_client_base(session, client_kwargs)
    ...
    >>> set_build_client_hook(hook)
```

