# SSO permissions mapping

> This feature requires Quilt stack version 1.54.0 or higher

## Overview

_SSO permissions mapping_ enables administrators to specify which roles are assigned
to new users depending on claims in their SSO ID token and is a form of
_just in time provisioning_.

You can use `quilt3.admin.sso_config.set()` or the Catalog Admin UI to configure
your mapping logic.

![admin UI for setting SSO permissions mapping](../imgs/admin-sso-config.png)

> Note: You cannot delete or rename roles referenced by the SSO configuration.
> Note: The last user to set a the mapping configuration becomes an admin in
> perpetuity.
> Note: Once a configuration is set you can no longer manually assign roles to
> SSO users.

## Configuration

The configuration file is YAML that conforms to the following
[JSON Schema](https://github.com/quiltdata/quilt/blob/master/shared/schemas/sso-config-1.0.json)
which includes descriptions of all the fields.

> Warning: Be sure to add any claims you wish to check under `required`,
> otherwise the schema will match _any_ ID token when the claims are missing.

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

1. The user with email `admin@example.com` will have the role `ReadWriteQuiltBucket`
role and will be an admin.
1. Any user with the group `rw` will have the `ReadWriteQuiltBucket` role and
will not be an admin (with the exception of the user `admin@example.com`).
1. All other users will have the `ReadQuiltBucket` role

> Note: Users who do not match any schema will have their role set to `default_role`
> and will retain their current admin / non-admin status.
