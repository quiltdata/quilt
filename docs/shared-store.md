# Sharing Package Storage

Groups that share packages across users can save storage and network traffic by installing packages from a shared directory (e.g. on a network file server).

## Create and populate shared package directory

1. Create a `quilt_packages` directory on the shared file system.

1. Set the `QUILT_PRIMARY_PACKAGE_DIR` to the path for `quilt_packages` in step 1. 
    ```bash
    # select a path that you control & is durable, e.g.
    export SHARE_PATH=YOUR_SHARED_PATH/quilt_packages
    export QUILT_PRIMARY_PACKAGE_DIR=$SHARE_PATH
    mkdir -p "$SHARE_PATH"
    chmod o+r "$SHARE_PATH"
    ```

1. Install packages to the shared directory
    ```bash
    quilt build USERNAME/PACKAGE PATH_TO_BUILD_YML
    quilt install USERNAME/PACKAGE
    ```

1. Set read permissions on shared directory and sub-directories
    ```bash
    chgrp -R readers "$QUILT_PRIMARY_PACKAGE_DIR"
    chmod -R g+rx "$QUILT_PRIMARY_PACKAGE_DIR"
    ```

## Configure clients to read from shared directory 
1. Each reader should set the following environment variable:
    ```bash
    # consider setting this in .bashrc
    export QUILT_PACKAGE_DIRS=$SHARE_PATH
    ```
2. Readers can can import shared packages as follows
    example:
    ```python
    from quilt.data.USERNAME import PACKAGE
    ```

## Import precedence
Quilt will first check `QUILT_PRIMARY` (defaults to the local machine) and then check `QUILT_PACKAGE_DIRS` (if available) when importing a package.

Refer to the [Python API docs](api-python.md) for details on quilt commands.
