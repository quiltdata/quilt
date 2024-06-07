
# quilt3.admin
APIs for Quilt administrators. 'Registry' refers to Quilt stack backend services, including identity management.

## get\_user(name: str) -> quilt3.admin.\_graphql\_client.get\_user.GetUserAdminUserGet  {#get\_user}

Get a specific user from the registry.

__Arguments__

* __name__:  Username of user to get.


## get\_users() -> List[quilt3.admin.\_graphql\_client.get\_users.GetUsersAdminUserList]  {#get\_users}

Get a list of all users in the registry.


## create\_user(name: str, email: str, role: str, extra\_roles: Optional[List[str]] = None) -> None  {#create\_user}

Create a new user in the registry.

__Arguments__

* __name__:  Username of user to create.
* __email__:  Email of user to create.
* __role__:  Active role of the user.
* __extra_roles__:  Additional roles to assign to the user.


## delete\_user(name: str) -> None  {#delete\_user}

Delete user from the registry.

__Arguments__

* __name__:  Username of user to delete.


## get\_roles() -> List[Union[quilt3.admin.\_graphql\_client.get\_roles.GetRolesRolesUnmanagedRole, quilt3.admin.\_graphql\_client.get\_roles.GetRolesRolesManagedRole]]  {#get\_roles}

Get a list of all roles in the registry.


## set\_role(name: str, role: str, extra\_roles: Union[List[str], NoneType, quilt3.admin.\_graphql\_client.base\_model.UnsetType] = <quilt3.admin.\_graphql\_client.base\_model.UnsetType object at 0x1058a00d0>, \*, append: bool = False) -> None  {#set\_role}

Set the active and extra roles for a user.

__Arguments__

* __name__:  Username of user to update.
* __role__:  Role to be set as the active role.
* __extra_roles__:  Additional roles to assign to the user.
* __append__:  If True, append the extra roles to the existing roles. If False, replace the existing roles.


## add\_roles(name: str, roles: List[str]) -> None  {#add\_roles}

Add roles to a user.

__Arguments__

* __name__:  Username of user to update.
* __roles__:  Roles to add to the user.


## remove\_roles(name: str, roles: List[str], fallback: Union[str, NoneType, quilt3.admin.\_graphql\_client.base\_model.UnsetType] = <quilt3.admin.\_graphql\_client.base\_model.UnsetType object at 0x1058a00d0>) -> None  {#remove\_roles}

Remove roles from a user.

__Arguments__

* __name__:  Username of user to update.
* __roles__:  Roles to remove from the user.
* __fallback__:  If set, the role to assign to the user if the active role is removed.

