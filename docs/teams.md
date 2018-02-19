# Teams (BETA)

A Quilt team is a single-tenant, dedicated registry with a private package namespace. As a team member, you can read and write packages from the team namespace.

Quilt teams include a special administrative interface for auditing data access, adding, and removing users.

The syntax for a team package handle is `TEAM:USER/PKG`.

If you'd like to use Quilt teams, [contact us](sales@quiltdata.io) to join the Beta.

# Command line API
Team users can have access to the [standard API](./api.md) with the following differences and additional administrative features.

## Core API differences
### `quilt push`
```sh
$ quilt push TEAM:USER/PKG --team
```
* `push --team` makes a package visible to everyone on your team
* ~~`push --public`~~ is currently disabled for team packages

### `quilt login`
Authenticate to  team registry:
```sh
$ quilt login TEAM
``` 

### `quilt access`
To make a package visible to your entire team:
```sh
$ quilt access add TEAM:USER/PKG team
```
Public visibility is not yet supported for team packages.

### Import and use data
```python
from quilt.team.TEAM.USER import PKG
```

## Admin features
### `quilt user list`
List users and associated metadata for your team.
```sh
quilt user list TEAM
```

### `quilt user create`
Add a team member.
```sh
$ quilt user create TEAM USERNAME EMAIL
```

### `quilt user disable`
Disable a team member.
```sh
quilt user disable TEAM USERNAME
```

### `quilt user reset-password`
Send a user a reset-password email.
```sh
quilt user reset-password TEAM USERNAME
```

### `quilt audit`
Audit events relating to a user or package.
```sh
quilt audit USER_OR_PACKAGE
```
