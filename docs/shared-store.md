# Sharing Package Storage

Groups that share packages among several users can save storage and network traffic by saving packages to a shared package directory (e.g. on a network file server).

## Create & populate shared package directory

1. Create a `quilt_packages` on the shared file system. Grant read access to all intended recipients. 

1. Set the `QUILT_PRIMARY_PACKAGE_DIR` to the path for `quilt_packages` in step 1. 
    ```bash
    export QUILT_PRIMARY_PACKAGE_DIR=/share/quilt_packages
    mkdir "$QUILT_PRIMARY_PACKAGE_DIR"
    ```

1. Install packages to the shared directory
    ```bash
    quilt build USERNAME/PACKAGE PATH_TO_BUILD_YML
    quilt install USERNAME/PACKAGE
    ```

1. Set read permissions on shared directory and sub-directories
    ```bash
    chgrp -R sharers "$QUILT_PRIMARY_PACKAGE_DIR"
    chmod -R g+rx "$QUILT_PRIMARY_PACKAGE_DIR"
    ```

## Configure clients to read from shared directory 
1. Each reader should set the following environment variable:
    ```bash
    export QUILT_PACKAGE_DIRS=/share/quilt_packages
    ```
2. Readers can can import shared packages as follows
    example:
    ```python
    from quilt.data.USERNAME import PACKAGE
    ```

See the [Python API](api-python.md) for more details on quilt commands.