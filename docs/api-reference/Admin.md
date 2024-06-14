
# quilt3.admin

APIs for Quilt administrators. 'Registry' refers to Quilt stack backend services, including identity management.


## ManagedRole(id: str, name: str, arn: str, typename\_\_: Literal['ManagedRole']) -> None  {#ManagedRole}


## UnmanagedRole(id: str, name: str, arn: str, typename\_\_: Literal['UnmanagedRole']) -> None  {#UnmanagedRole}


## User(name: str, email: str, date\_joined: datetime.datetime, last\_login: datetime.datetime, is\_active: bool, is\_admin: bool, is\_sso\_only: bool, is\_service: bool, role: Optional[Annotated[Union[quilt3.admin.ManagedRole, quilt3.admin.UnmanagedRole], FieldInfo(annotation=NoneType, required=True, discriminator='typename\_\_')]], extra\_roles: List[Annotated[Union[quilt3.admin.ManagedRole, quilt3.admin.UnmanagedRole], FieldInfo(annotation=NoneType, required=True, discriminator='typename\_\_')]]) -> None  {#User}


## get\_roles() -> List[Union[quilt3.admin.ManagedRole, quilt3.admin.UnmanagedRole]]  {#get\_roles}

Get a list of all roles in the registry.


## get\_user(name: str) -> Optional[quilt3.admin.User]  {#get\_user}

Get a specific user from the registry. Return `None` if the user does not exist.

__Arguments__

* __name__:  Username of user to get.


## get\_users() -> List[quilt3.admin.User]  {#get\_users}

Get a list of all users in the registry.


## create\_user(name: str, email: str, role: str, extra\_roles: Optional[List[str]] = None) -> quilt3.admin.User  {#create\_user}

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


## set\_user\_email(name: str, email: str) -> quilt3.admin.User  {#set\_user\_email}

Set the email for a user.

__Arguments__

* __name__:  Username of user to update.
* __email__:  Email to set for the user.


## set\_user\_admin(name: str, admin: bool) -> quilt3.admin.User  {#set\_user\_admin}

Set the admin status for a user.

__Arguments__

* __name__:  Username of user to update.
* __admin__:  Admin status to set for the user.


## set\_user\_active(name: str, active: bool) -> quilt3.admin.User  {#set\_user\_active}

Set the active status for a user.

__Arguments__

* __name__:  Username of user to update.
* __active__:  Active status to set for the user.


## reset\_user\_password(name: str) -> None  {#reset\_user\_password}

Reset the password for a user.

__Arguments__

* __name__:  Username of user to update.


## set\_role(name: str, role: str, extra\_roles: Optional[List[str]] = None, \*, append: bool = False) -> quilt3.admin.User  {#set\_role}

Set the active and extra roles for a user.

__Arguments__

* __name__:  Username of user to update.
* __role__:  Role to be set as the active role.
* __extra_roles__:  Additional roles to assign to the user.
* __append__:  If True, append the extra roles to the existing roles. If False, replace the existing roles.


## add\_roles(name: str, roles: List[str]) -> quilt3.admin.User  {#add\_roles}

Add roles to a user.

__Arguments__

* __name__:  Username of user to update.
* __roles__:  Roles to add to the user.


## remove\_roles(name: str, roles: List[str], fallback: Optional[str] = None) -> quilt3.admin.User  {#remove\_roles}

Remove roles from a user.

__Arguments__

* __name__:  Username of user to update.
* __roles__:  Roles to remove from the user.
* __fallback__:  If set, the role to assign to the user if the active role is removed.

