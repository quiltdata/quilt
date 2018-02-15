# Teams (Beta)

A Quilt team is a single-tenant, dedicated registry with a private package namespace. As a team member, you can install and push packages in that team namespace.

Quilt teams include a special administrative interface for auditing data access, adding, and removing users.

The general notation for a team package is `TEAM:USER/PKG`, where `TEAM` is the team name.

The standard Quilt [CLI](./cli.md) and [Python](api-python.md) APIs work for teams. Below are the APIs that differ.

If you're interested in using teams, please [contact us](sales@quiltdata.io) to join the Beta.

# Command Line

## `quilt push`
```sh
$ quilt push TEAM:USER/PKG --team
```
* `push --team` makes a package visible to everyone on your team.
* ~~`push --public`~~ is currently disabled for team packages.

## `quilt access`

To make a package visible to your entire team:
```sh
$ quilt access add TEAM:USER/PKG team
```

Public visibility is disabled for team packages.

## `quilt login`

Run `quilt login TEAM` to authenticate to your team registry.

# Admin Command Line features

## `quilt user list`
List users and associated metadata for your team.
```sh
quilt user list TEAM
```

## `quilt user create`
Add a team member.
```sh
$ quilt user create TEAM USERNAME EMAIL
```

## `quilt user disable`
Disable a team member.
```sh
quilt user disable TEAM USERNAME
```

## `quilt user reset-password`
Send a user a reset-password email.
```sh
quilt user reset-password TEAM USERNAME
```

## `quilt audit`
Audit events relating to a user or package.
```sh
quilt audit USER_OR_PACKAGE
```

# Python API
## Import data
To import a team package, use the following syntax:
```python
from quilt.TEAM.USER import PKG
```
