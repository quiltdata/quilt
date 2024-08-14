# SSO permissions mapping

> This feature requires Quilt stack version 1.54.0 or higher

## Overview

This feature allows Quilt admin to configure what roles and admin flag value are
assigned to the user who logs in via SSO given on the user's ID token claims.

The configuration can be initially set with admin `quilt3.admin.sso_config.set()`
and subsequently can be update with admin UI as well.

![admin UI for setting SSO permissions mapping](../imgs/admin-sso-config.png)

> Note: Roles used by configuration can't be removed or renamed.

> Note: User who sets configuration last can't be revoked admin flag.

> Note: After configuration is set, all user who logs in via SSO can't be manually
assigned roles or admin flag.

## Configuration

The configuration file is to be written in YAML and is defined by [this JSON Schema](https://github.com/quiltdata/quilt/blob/master/shared/schemas/sso-config-1.0.json)
which has description of all the fields.

> Warning: In schemas don't forget to add claims you want to check to `required`,
because otherwise the schema will match ID token if these claims are missing.

### Example

```yaml
version: "1.0"
default_role: ReadQuiltBucket
mappings:
  - schema:
      type: object
      properties:
        email:
          const: admin@example.com
      required:
        - email
    roles:
      - ReadWriteQuiltBucket
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

1. user with email `admin@example.com` will have `ReadWriteQuiltBucket` role and
admin flag set to true
1. user with group `rw` will have `ReadWriteQuiltBucket` role and admin flag set
to false (except the user with `admin@example.com` email)
1. all other users will have `ReadQuiltBucket` role
