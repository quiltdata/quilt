# Teams (Beta)

A team in Quilt is a private package namespace and access control specification. As a team member, you can install and push packages in that team namespace.

The general notation for a team package is `TEAM:USER/PKG`.

Most Quilt commands work just like normal whether you're part of a team or not. The rest of this document lists all the exceptions.

If you're interested in using this feature, please [contact us](sales@quiltdata.io) to join the Beta.

# Command line

## `quilt push`

`quilt push --public` is disallowed for team packages. Use `quilt push --team` to push a package visible to everyone in your team.

Example: `quilt push --team myteam:me/my_pkg`

## `quilt access`

Public visibility is disabled for team packages. To make a private team package visible to your team, run `quilt access add team:user/pkg team` where `team` is the name of your team. To make a private package visible to select other members of your team, run `quilt access add team:user/pkg other_user` for each user you want to add.

Example: `quilt access add myteam:me/mypkg myteam` to make package team-visible.
`quilt access add myteam:me/mypkg other_user_on_my_team` to share a private package.

## `quilt login`

Run `quilt login team` to login as a member of a team.

# `Python API`
## Import data
To import a team package, use the following syntax:
```python
from quilt.team.TEAM.USER import PKG`
```
