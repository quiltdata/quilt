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

> Note: Mappings are evaluated in order, and **only the first matching
mapping is applied**. To assign multiple roles to a user, include all roles
in the `roles` array of a single mapping.

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

> Note: Unrecognized users will have their role set to the `default_role`, but
their admin flag will be unchanged.

## Configuring your IdP to emit the required claims

Mappings only match against claims that actually appear in the user's ID token.
If your mapping checks `groups` but the IdP doesn't include a `groups` claim,
**no mapping will match** and users will silently fall through to the
`default_role` — which (per the note above) leaves their admin flag unchanged
from whatever it was before.

A common symptom is users receiving the `default_role` even though they belong
to the groups referenced in the mappings. Verify by pasting their ID token into
[jwt.io](https://jwt.io/) and confirming the expected claims are present.

### Okta

Okta does **not** emit a `groups` claim by default. The claim name `groups` is
also reserved, so it cannot be added via **Token claims → Add expression** on
the application's **Sign On** tab. Use the legacy configuration instead:

1. Open **Applications → [Your App] → Sign On** tab.
2. Under **OpenID Connect ID Token**, click **Show legacy configuration**.
3. Set **Groups claim type** to `Filter`.
4. Set **Groups claim filter** to `groups` | **Matches regex** | `.*`
   (or a narrower expression that includes every group your mappings reference).
5. Save.

After saving, affected users must log out and back in for the new ID token to
include the `groups` claim. Confirm with jwt.io that the token now contains
something like `"groups": ["Everyone", "Employees", ...]`.

### Azure AD / Entra ID

In **Enterprise Applications → [Your App] → Single sign-on → Attributes &
Claims**, add a `groups` claim and set its source to the security groups
assigned to the user. For OIDC apps, configure the **Token configuration**
blade to include the `groups` optional claim.

### Google Workspace

Google does not emit group membership in OIDC ID tokens by default. Use a
different claim (such as `hd` for hosted domain or `email`) in your mappings,
or configure a custom claim via your IdP's admin console.
