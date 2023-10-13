
# quilt3.admin
Admin APIs for Quilt stacks.

## create\_user(\*, username: str, email: str)  {#create\_user}

Create a new user in your registry.

Required parameters:
    username (str): Username of user to create.
    email (str): Email of user to create.


## delete\_user(\*, username: str)  {#delete\_user}

Delete user from your registry.

Required parameters:
    username (str): Username of user to delete.


## set\_role(\*, username: str, role\_name: Union[str, NoneType])  {#set\_role}

Set which role is associated with a user.

Required parameters:
    username (str): Username of user to update.
    role_name (str): Role name to set for the user. Use `None` to unset role.

