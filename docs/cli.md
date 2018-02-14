# Help
* `quilt -h` for a list of commands
* `quilt CMD -h` for info about a command

# Core
* `quilt ls` to list installed packages
* `quilt build USER/PACKAGE [SOURCE DIRECTORY or FILE.YML]`
* `quilt push [--public] USER/PACKAGE` stores the package in the registry
 * Quilt's Free tier supports only `push --public`
 * A `README.md` file is recommended at the root of your package. README files use markdown syntax via [remarkable](https://jonschlinkert.github.io/remarkable/demo/).
* `quilt install [-x HASH | -v VERSION | -t TAG] [USER/PACKAGE[/SUBPATH...] or @QUILT_YML_FILE]` installs a package.
* `quilt generate [DIRECTORY]` creates a build.yml file from a directory of files.  You can customize this before running `quilt build` and `quilt push`.
* `quilt rm [USER/PACKAGE] [--force]`  Remove a package (all instances/versions) from the local store.

# Versioning
* `quilt log USER/PACKAGE` to see the push history
* `quilt version list USER/PACKAGE` to see versions of a package
* `quilt version add USER/PACKAGE VERSION HASH` to associate a version with a hash
* `quilt tag list USER/PACKAGE` to list tags
* `quilt tag add USER/PACKAGE TAG HASH` to associate a tag with a hash
* The tag `"latest"` is automatically added to the most recent push
* `quilt tag remove USER/PACKAGE TAG` to remove a tag

# Permissions
* `quilt login [TEAM]` to authenticate
 * Users must authenticate to push packages
* `quilt access list USER/PACKAGE` to see who has access to a package
* `quilt access {add, remove} USER/PACKAGE ANOTHER_USER` to add/remove read-only users
 * `quilt access add public` makes a package world readable
* `quilt delete USER/PACKAGE` removes the package from the registry; does not delete local data, so you may still see a local copy in `quilt ls`

# Search
* `quilt search "SEARCH STRING"` to search for packages by user or package name

# Short hashes

All commands such as `quilt install` support "short hashes," i.e. any unique prefix of a hash will be matched against the longer hash.  For example, `quilt install akarve/examples -x 4594b58d64dd9c98b79b628370618031c66e80cbbd1db48662be0b7cac36a74e can be shortened to `quilt install akarve/examples -x 4594b5` assuming there's no other hashes that start with this sequence.  In practice, 6-8 characters is usually sufficient to achieve uniqueness.

# Installing via requirements file (quilt.yml)
```sh
$ quilt install [@filename]
# quilt.yml is the default if @filename is absent
```

Installs a list of packages specified by a YAML file. The YAML file must contain a `packages` node with a list of packages of the form  `USER/PACKAGE[/SUBPACKAGE][:hash|:tag|:version][:HASH|TAG|VERSION]`.

## Example

```
packages:
  - vgauthier/DynamicPopEstimate   # get the latest version
  - danWebster/sgRNAs:a972d92      # get a specific version via hash (short hash)
  - akarve/sales:tag:latest        # get a specific version via tag
  - asah/snli:v:1.0                # get a specific version via version

```

***
