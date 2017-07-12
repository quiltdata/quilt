# Help
* `quilt -h` for a list of commands
* `quilt CMD -h` for info about a command

# Permissions
* `quilt login` to authenticate
  * Users must authenticate to push packages
* `quilt access list USER/PACKAGE` to see who has access to a package
* `quilt access {add, remove} USER/PACKAGE ANOTHER_USER` to add/remove read-only users
 * `quilt access add public` makes a package world readable

# Core
* `quilt ls` to list installed packages
* `quilt build USER/PACKAGE [SOURCE DIRECTORY or FILE.YML]`
* `quilt push [--public] USER/PACKAGE` stores the package in the registry
  * Quilt's Free tier supports only `push --public`

* `quilt install [-x HASH | -v VERSION | -t TAG] USER/PACKAGE` installs a package

# Versioning
* `quilt log USER/PACKAGE` to see the push history
* `quilt version list USER/PACKAGE` to see versions of a package
* `quilt version add USER/PACKAGE VERSION HASH` to associate a version with a hash
* `quilt tag list USER/PACKAGE` to list tags
* `quilt tag add USER/PACKAGE TAG HASH` to associate a tag with a hash
  * The tag "latest" is automatically added to the most recent push
* `quilt tag remove USER/PACKAGE TAG` to remove a tag
