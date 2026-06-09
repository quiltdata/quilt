<!-- markdownlint-disable no-blanks-blockquote -->
# SSO permissions mapping

> This feature requires Quilt Platform version 1.54.0 or higher

## Overview

This feature allows Quilt admin to configure what roles and admin flag value are
assigned to the user who logs in via SSO based on the user's ID token claims.

The configuration can be set with `quilt3.admin.sso_config.set()`
or with admin UI.

![admin UI for setting SSO permissions mapping](../imgs/admin-sso-config.png)

> Note: Roles used by configuration can't be removed or renamed.

> Note: The user who sets the configuration will never have their admin flag revoked.

> Note: After configuration is set, any user who logs in via SSO can't be manually
assigned roles or admin permissions.

## Configuration

The configuration file is to be written in YAML and is defined by [this JSON Schema](https://github.com/quiltdata/quilt/blob/master/shared/schemas/sso-config-1.0.json)
which includes descriptions of all the fields.

> Warning: In schemas don't forget to add claims you want to check to `required`,
because otherwise the schema will match any ID token even if these claims are missing.

> Note: By default, mappings are evaluated in order and **only the first
matching mapping is applied** — to assign multiple roles to a user this way,
include all roles in the `roles` array of a single mapping. Alternatively,
set `union_roles: true` at the top level of the config (Quilt Platform 1.69+)
to grant the union of roles from **all** matching mappings; users can switch
between the assigned roles via the role switcher, and any role no longer in
the match set is revoked on next login.

> Note: Under `union_roles: true`, the `admin` flag is **tri-state** and is
**not** simply unioned the way `roles` are:
>
> - omitted — the mapping does not vote on admin,
> - `true` — the mapping grants admin,
> - `false` — the mapping **vetoes** admin.
>
> A user is made admin only if **at least one** matching mapping sets
`admin: true` **and no** matching mapping sets `admin: false`. An explicit
`admin: false` on any matching mapping therefore blocks admin even when
another matching mapping sets `admin: true`. This matters for broad
catch-all mappings (e.g. a domain-wide `pattern`) that a privileged user
also matches: to avoid demoting such users, **omit** `admin` on the
catch-all rather than setting `admin: false` — reserve `admin: false` for
when you intend to actively deny admin. (With `union_roles: false`, only the
first matching mapping applies, so its `admin` value alone is used.)

### Example

```yaml
version: "1.0"
default_role: ReadQuiltBucket
union_roles: true
mappings:
  - schema:
      type: object
      properties:
        email:
          const: admin@example.com
      required:
        - email
    roles:
      - AdminTools
    admin: true
  - schema:
      type: object
      properties:
        groups:
          type: array
          contains:
            const: rw
      required:
        - groups
    roles:
      - ReadWriteQuiltBucket
```

By default (or with `union_roles: false`), only the first matching mapping
applies — the `admin@example.com` user above would receive `AdminTools` only.
With `union_roles: true`, that same user is granted both `AdminTools` and
`ReadWriteQuiltBucket` and can switch between them via the role switcher; a
user with group `rw` only is granted `ReadWriteQuiltBucket` in either mode.
The `admin@example.com` user remains admin because the first mapping sets
`admin: true` and the second mapping **omits** `admin` (a non-vote) rather
than setting `admin: false` — had it set `admin: false`, admin would be
vetoed (see the tri-state note above).

> Note: Users matching no mapping receive the `default_role`
(`ReadQuiltBucket` in this example). Their admin flag is unchanged.
