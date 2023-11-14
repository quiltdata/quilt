
# quilt3.admin
APIs for Quilt administrators. 'Registry' refers to Quilt stack backend services, including identity management.

## create\_user(\*, username: str, email: str)  {#create\_user}

Create a new user in the registry.

Required parameters:
    username (str): Username of user to create.
    email (str): Email of user to create.


## delete\_user(\*, username: str)  {#delete\_user}

Delete user from the registry.

Required parameters:
    username (str): Username of user to delete.


## set\_role(\*, username: str, role\_name: Union[str, NoneType])  {#set\_role}

Set the named Quilt role for a user.

Required parameters:
    username (str): Username of user to update.
    role_name (str): Quilt role name assign to the user. Set a `None` value to unassign the role.

