# Teams BETA

A team in Quilt is a separate package namespace and access control specification. Being part of a team lets you install and push team-visible packages.

The general notation for a team package is team:user/pkg.

Most Quilt commands work just like normal whether you're part of a team or not. The rest of this document lists all the exceptions.

## `quilt push`

`quilt push --public` is disallowed for team packages. Use `quilt push --team` to push a package visible to everyone in your team.

## `quilt access`

Public visibility is disabled for team packages. To make a private team package visible to your team, run `quilt access add team:user/pkg team` where `team` is the name of your team.

## `quilt login`

Run `quilt login team` to login as a member of a team.

## `Python API`

Importing team packages is a little different. Instead of the usual invocation, use `from quilt.team.user import pkg` where team is the name of your team.
