# Teams

Quilt Teams offer enhanced security, auditing, and privacy. Only team members can read and write data to and from the team. Teams are controlled by one or more admins who have access to a special web interface where they can audit data usage, add new members, and more.

Technically, a Quilt team is a dedicated, single-tenant registry with a private package namespace. Teams also feature their own web searchable catalog (accessible only to team members), similar to [quiltdata.com](https://quiltdata.com).

To create your own Quilt team, [contact us](sales@quiltdata.io).

# Command line API
Team members have access to the [standard API](./api.md) with the following differences and additional features.

## Differences in the Core API/disbl
### `quilt login`
Authenticate to  team registry:
```
quilt login TEAM
``` 

### `quilt build|push|install`
Team users should prefix package handles with the team namespace:
```
quilt build|push|install TEAM:USER/PKG
```
## `quilt push` visibility
* `quilt push --team` makes a package visible to everyone on your team
* ~~`quilt push --public`~~ is currently disabled for team packages

### `quilt access`
To make a package visible to your entire team:
```
quilt access add TEAM:USER/PKG team
```
Public visibility is not yet supported for team packages.

### Import and use data
```python
from quilt.team.TEAM.USER import PKG
```

## Admin features
### `quilt user list`
List users and associated metadata for your team.
```
quilt user list TEAM
```

### `quilt user create`
Add a team member.
```
quilt user create TEAM USERNAME EMAIL
```

### `quilt user disable`
Disable a team member.
```
quilt user disable TEAM USERNAME
```

### `quilt user reset-password`
Send a user a reset-password email.
```
quilt user reset-password TEAM USERNAME
```

### `quilt audit`
Audit events relating to a user or package.
```
quilt audit USER_OR_PACKAGE
```
