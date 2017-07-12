# Quilt shell commands

## Help
* `quilt -h` for a list of commands
* `quilt CMD -h` for info about a command

## Permissions
* `quilt login` to authenticate (required to push packages)
* `quilt access list USER/PACKAGE` to see who has access to a package
* `quilt access {add, remove} USER/PACKAGE ANOTHER_USER` to set access
* `quilt access add public` makes a package visible to the world


## Core
* `quilt build USER/PACKAGE [SOURCE DIRECTORY or FILE.YML]`
* `quilt push [--public] USER/PACKAGE` stores the package in the registry
  * Quilt's Free tier supports `push --public` only

* `quilt install [-x HASH | -v VERSION | -t TAG] USER/PACKAGE` installs a package

## Versioning
* `quilt log USER/PACKAGE` to see all changes to a package
* `quilt version list USER/PACKAGE` to see versions of a package
* `quilt version add USER/PACKAGE VERSION HASH` to create a new version
* `quilt tag list USER/PACKAGE` to see tags of a package
* `quilt tag add USER/PACKAGE TAG HASH` to create a new tag
  * The tag "latest" is automatically added to the most recent push
* `quilt tag remove USER/PACKAGE TAG` to delete a tag
