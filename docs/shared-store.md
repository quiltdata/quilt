# Sharing Package Storage

Groups that share packages among several users can save storage and network traffic by saving packages to a shared package directory, e.g., on their local network file server.

## Create a Shared Local Package Repository

First create a directory with the name `quilt_packages` somewhere on your shared file system. Next, set the environment variable `QUILT_PRIMARY_PACKAGE_DIR` to the package directory.
example:
```bash
export QUILT_PRIMARY_PACKAGE_DIR=/share/quilt_packages
mkdir "$QUILT_PRIMARY_PACKAGE_DIR"
```

Once the shared package directory is created and `QUILT_PRIMARY_PACKAGE_DIR` is set, you can add packages to the shared package store with `quilt install` and `quilt build`.

example:
```bash
quilt build <username>/<package> <path>
quilt install <username>/<package>
```

Once you've added the packages, you'll need to add read permission to the shared packages directory and all of its subdirectories.
example:
```bash
chgrp -R sharers "$QUILT_PRIMARY_PACKAGE_DIR"
chmod -R g+rx "$QUILT_PRIMARY_PACKAGE_DIR"
```

## Import Packages from a Shared Local Package Repository

Collaborators sharing packages from the shared local package repository need to configure Quilt by adding the local package directory to their search path. Set the `QUILT_PACKAGE_DIRS` environment variable. 

example:
```bash
export QUILT_PACKAGE_DIRS=/share/quilt_packages
```
```python
from quilt.data.username import package
```