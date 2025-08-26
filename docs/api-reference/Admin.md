# Quilt Administration API Reference

The `quilt3.admin` module provides comprehensive administrative capabilities for managing Quilt catalogs, users, roles, and system configuration. This API requires administrative privileges and is designed for programmatic management of Quilt deployments.

## Overview

The admin API is organized into several modules:

- **`quilt3.admin.users`** - User management operations
- **`quilt3.admin.roles`** - Role management and listing
- **`quilt3.admin.sso_config`** - Single Sign-On configuration
- **`quilt3.admin.tabulator`** - Tabulator table management
- **`quilt3.admin.types`** - Data types and models

## Authentication and Authorization

All admin operations require:
1. Valid Quilt authentication (`quilt3.login()`)
2. Administrative privileges in the target catalog
3. Appropriate IAM permissions for the underlying AWS resources

```python
import quilt3
import quilt3.admin.users as admin_users

# Ensure you're logged in with admin privileges
quilt3.login()

# Verify admin access
try:
    users = admin_users.list()
    print(f"Successfully connected. Found {len(users)} users.")
except Exception as e:
    print(f"Admin access required: {e}")
```

---

# quilt3.admin.types

## ManagedRole(id: str, name: str, arn: str, typename\_\_: Literal['ManagedRole']) -> None  {#ManagedRole}

Represents a role managed by Quilt with policies controlled through the Quilt admin interface.

**Attributes:**
- `id`: Unique identifier for the role
- `name`: Human-readable role name
- `arn`: AWS IAM role ARN
- `typename__`: Discriminator field (always 'ManagedRole')

## UnmanagedRole(id: str, name: str, arn: str, typename\_\_: Literal['UnmanagedRole']) -> None  {#UnmanagedRole}

Represents an external IAM role not managed by Quilt policies.

**Attributes:**
- `id`: Unique identifier for the role
- `name`: Human-readable role name  
- `arn`: AWS IAM role ARN
- `typename__`: Discriminator field (always 'UnmanagedRole')

## User(name: str, email: str, date\_joined: datetime.datetime, last\_login: datetime.datetime, is\_active: bool, is\_admin: bool, is\_sso\_only: bool, is\_service: bool, role: Optional[Role], extra\_roles: List[Role]) -> None  {#User}

Represents a Quilt user with comprehensive metadata and role assignments.

**Attributes:**
- `name`: Username (unique identifier)
- `email`: User's email address
- `date_joined`: When the user account was created
- `last_login`: Most recent login timestamp
- `is_active`: Whether the user account is active
- `is_admin`: Whether the user has administrative privileges
- `is_sso_only`: Whether the user can only authenticate via SSO
- `is_service`: Whether this is a service account
- `role`: Primary role assignment
- `extra_roles`: Additional roles assigned to the user

## SSOConfig(text: str, timestamp: datetime.datetime, uploader: User) -> None  {#SSOConfig}

Represents SSO configuration with metadata about when and by whom it was set.

**Attributes:**
- `text`: SSO configuration content
- `timestamp`: When the configuration was last updated
- `uploader`: User who uploaded/modified the configuration

## TabulatorTable(name: str, config: str) -> None  {#TabulatorTable}

Represents a tabulator table configuration for SQL querying across packages.

**Attributes:**
- `name`: Table name
- `config`: YAML configuration defining schema and data sources

---

# quilt3.admin.roles

## list() -> List[Union[ManagedRole, UnmanagedRole]]  {#list}

Get a list of all roles available in the registry.

**Returns:** List of role objects (both managed and unmanaged)

**Example:**
```python
import quilt3.admin.roles as admin_roles

roles = admin_roles.list()
for role in roles:
    print(f"Role: {role.name} ({role.typename__})")
    print(f"  ARN: {role.arn}")
```

**Common Use Cases:**
- Auditing available roles
- Populating role selection interfaces
- Validating role assignments before user creation

---

# quilt3.admin.users

## get(name: str) -> Optional[User]  {#get}

Retrieve detailed information about a specific user.

**Arguments:**
- `name`: Username of the user to retrieve

**Returns:** User object if found, None otherwise

**Example:**
```python
import quilt3.admin.users as admin_users

user = admin_users.get("john.doe")
if user:
    print(f"User: {user.name}")
    print(f"Email: {user.email}")
    print(f"Admin: {user.is_admin}")
    print(f"Active: {user.is_active}")
    print(f"Primary Role: {user.role.name if user.role else 'None'}")
    print(f"Extra Roles: {[r.name for r in user.extra_roles]}")
else:
    print("User not found")
```

## list() -> List[User]  {#list}

Get a comprehensive list of all users in the registry.

**Returns:** List of all User objects

**Example:**
```python
import quilt3.admin.users as admin_users

users = admin_users.list()
print(f"Total users: {len(users)}")

# Filter active users
active_users = [u for u in users if u.is_active]
print(f"Active users: {len(active_users)}")

# Find administrators
admins = [u for u in users if u.is_admin]
print(f"Administrators: {[u.name for u in admins]}")
```

## create(name: str, email: str, role: str, extra\_roles: Optional[List[str]] = None) -> User  {#create}

Create a new user account in the registry.

**Arguments:**
- `name`: Username (must be unique)
- `email`: User's email address
- `role`: Primary role name to assign
- `extra_roles`: Optional list of additional role names

**Returns:** Newly created User object

**Example:**
```python
import quilt3.admin.users as admin_users

# Create a basic user
new_user = admin_users.create(
    name="jane.smith",
    email="jane.smith@company.com",
    role="data-analyst"
)

# Create a user with multiple roles
power_user = admin_users.create(
    name="data.engineer",
    email="engineer@company.com", 
    role="data-engineer",
    extra_roles=["data-analyst", "package-creator"]
)

print(f"Created user: {new_user.name}")
```

**Best Practices:**
- Use consistent naming conventions (e.g., firstname.lastname)
- Assign minimal necessary roles initially
- Verify role names exist before creation
- Use corporate email addresses for user identification

## delete(name: str) -> None  {#delete}

Remove a user account from the registry.

**Arguments:**
- `name`: Username of the user to delete

**Example:**
```python
import quilt3.admin.users as admin_users

# Verify user exists before deletion
user = admin_users.get("old.user")
if user:
    admin_users.delete("old.user")
    print("User deleted successfully")
else:
    print("User not found")
```

**⚠️ Warning:** This operation is irreversible. Consider deactivating users instead of deleting them to preserve audit trails.

## set\_email(name: str, email: str) -> User  {#set\_email}

Update a user's email address.

**Arguments:**
- `name`: Username of the user to update
- `email`: New email address

**Returns:** Updated User object

**Example:**
```python
import quilt3.admin.users as admin_users

updated_user = admin_users.set_email("john.doe", "john.doe@newcompany.com")
print(f"Updated email for {updated_user.name}: {updated_user.email}")
```

## set\_admin(name: str, admin: bool) -> User  {#set\_admin}

Grant or revoke administrative privileges for a user.

**Arguments:**
- `name`: Username of the user to update
- `admin`: True to grant admin privileges, False to revoke

**Returns:** Updated User object

**Example:**
```python
import quilt3.admin.users as admin_users

# Grant admin privileges
admin_user = admin_users.set_admin("trusted.user", True)
print(f"{admin_user.name} is now an administrator")

# Revoke admin privileges  
regular_user = admin_users.set_admin("former.admin", False)
print(f"{regular_user.name} is no longer an administrator")
```

**Security Note:** Ensure proper approval processes before granting administrative access.

## set\_active(name: str, active: bool) -> User  {#set\_active}

Activate or deactivate a user account.

**Arguments:**
- `name`: Username of the user to update
- `active`: True to activate, False to deactivate

**Returns:** Updated User object

**Example:**
```python
import quilt3.admin.users as admin_users

# Deactivate a user (preferred over deletion)
deactivated_user = admin_users.set_active("departing.employee", False)
print(f"Deactivated user: {deactivated_user.name}")

# Reactivate a user
reactivated_user = admin_users.set_active("returning.contractor", True)
print(f"Reactivated user: {reactivated_user.name}")
```

## reset\_password(name: str) -> None  {#reset\_password}

Reset a user's password, forcing them to set a new one on next login.

**Arguments:**
- `name`: Username of the user whose password to reset

**Example:**
```python
import quilt3.admin.users as admin_users

admin_users.reset_password("forgot.password")
print("Password reset. User will be prompted to set new password on next login.")
```

## set\_role(name: str, role: str, extra\_roles: Optional[List[str]] = None, \*, append: bool = False) -> User  {#set\_role}

Set the primary and additional roles for a user.

**Arguments:**
- `name`: Username of the user to update
- `role`: Primary role name to assign
- `extra_roles`: Additional roles to assign
- `append`: If True, append to existing extra roles; if False, replace them

**Returns:** Updated User object

**Example:**
```python
import quilt3.admin.users as admin_users

# Replace all roles
user = admin_users.set_role(
    name="john.doe",
    role="senior-analyst", 
    extra_roles=["package-creator", "data-reviewer"]
)

# Append to existing roles
user = admin_users.set_role(
    name="jane.smith",
    role="data-engineer",
    extra_roles=["admin-trainee"],
    append=True
)
```

## add\_roles(name: str, roles: List[str]) -> User  {#add\_roles}

Add additional roles to a user without affecting existing roles.

**Arguments:**
- `name`: Username of the user to update
- `roles`: List of role names to add

**Returns:** Updated User object

**Example:**
```python
import quilt3.admin.users as admin_users

# Add temporary project access
updated_user = admin_users.add_roles(
    name="contractor.user",
    roles=["project-alpha-access", "temporary-reviewer"]
)
print(f"Added roles to {updated_user.name}")
```

## remove\_roles(name: str, roles: List[str], fallback: Optional[str] = None) -> User  {#remove\_roles}

Remove specific roles from a user.

**Arguments:**
- `name`: Username of the user to update
- `roles`: List of role names to remove
- `fallback`: Role to assign if the primary role is removed

**Returns:** Updated User object

**Example:**
```python
import quilt3.admin.users as admin_users

# Remove project access after completion
updated_user = admin_users.remove_roles(
    name="project.member",
    roles=["project-alpha-access"],
    fallback="standard-user"  # In case primary role is removed
)
```

---

# quilt3.admin.sso_config

## get() -> Optional[SSOConfig]  {#get}

Retrieve the current SSO configuration.

**Returns:** SSOConfig object if configured, None otherwise

**Example:**
```python
import quilt3.admin.sso_config as admin_sso

config = admin_sso.get()
if config:
    print(f"SSO configured by: {config.uploader.name}")
    print(f"Last updated: {config.timestamp}")
    print(f"Configuration length: {len(config.text)} characters")
else:
    print("No SSO configuration found")
```

## set(config: Optional[str]) -> Optional[SSOConfig]  {#set}

Set or update the SSO configuration.

**Arguments:**
- `config`: SSO configuration string, or None to remove configuration

**Returns:** Updated SSOConfig object, or None if configuration was removed

**Example:**
```python
import quilt3.admin.sso_config as admin_sso

# Set SSO configuration
sso_xml = """<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata"
                     entityID="https://your-idp.com/metadata">
  <!-- Your SAML metadata here -->
</md:EntityDescriptor>"""

config = admin_sso.set(sso_xml)
print(f"SSO configuration updated by: {config.uploader.name}")

# Remove SSO configuration
admin_sso.set(None)
print("SSO configuration removed")
```

**Security Considerations:**
- Validate SAML metadata before setting
- Test SSO configuration in a staging environment first
- Ensure backup admin accounts exist before enabling SSO
- Monitor SSO authentication logs after deployment

---

# quilt3.admin.tabulator

Tabulator enables SQL querying across multiple Quilt packages by creating virtual tables that aggregate package contents based on configurable patterns.

## list\_tables(bucket\_name: str) -> List[TabulatorTable]  {#list\_tables}

List all tabulator tables configured for a specific bucket.

**Arguments:**
- `bucket_name`: Name of the S3 bucket

**Returns:** List of TabulatorTable objects

**Example:**
```python
import quilt3.admin.tabulator as admin_tabulator

tables = admin_tabulator.list_tables("my-data-bucket")
for table in tables:
    print(f"Table: {table.name}")
    print(f"Config: {table.config[:100]}...")  # First 100 chars
```

## set\_table(bucket\_name: str, table\_name: str, config: Optional[str]) -> None  {#set\_table}

Create, update, or delete a tabulator table configuration.

**Arguments:**
- `bucket_name`: Name of the S3 bucket
- `table_name`: Name of the tabulator table
- `config`: YAML configuration string, or None to delete the table

**Example:**
```python
import quilt3.admin.tabulator as admin_tabulator

# Create a tabulator table
table_config = """
schema:
  - name: id
    type: STRING
  - name: value
    type: FLOAT
  - name: timestamp
    type: TIMESTAMP

source:
  type: quilt-packages
  package_name: '(?P<dataset>.*)/data'
  logical_key: 'results/(?P<experiment>.*)\\.csv'

parser:
  format: csv
  header: true
  delimiter: ","
"""

admin_tabulator.set_table(
    bucket_name="research-data",
    table_name="experiment_results", 
    config=table_config
)

# Delete a table
admin_tabulator.set_table(
    bucket_name="research-data",
    table_name="old_table",
    config=None
)
```

## rename\_table(bucket\_name: str, table\_name: str, new\_table\_name: str) -> None  {#rename\_table}

Rename an existing tabulator table.

**Arguments:**
- `bucket_name`: Name of the S3 bucket
- `table_name`: Current table name
- `new_table_name`: New table name

**Example:**
```python
import quilt3.admin.tabulator as admin_tabulator

admin_tabulator.rename_table(
    bucket_name="analytics-data",
    table_name="temp_analysis",
    new_table_name="quarterly_analysis"
)
```

## get\_open\_query() -> bool  {#get\_open\_query}

Check if open query mode is enabled for tabulator.

**Returns:** True if open query is enabled, False otherwise

Open query mode allows broader access to tabulator functionality without strict package-based restrictions.

**Example:**
```python
import quilt3.admin.tabulator as admin_tabulator

if admin_tabulator.get_open_query():
    print("Open query mode is enabled")
else:
    print("Open query mode is disabled")
```

## set\_open\_query(enabled: bool) -> None  {#set\_open\_query}

Enable or disable open query mode for tabulator.

**Arguments:**
- `enabled`: True to enable open query mode, False to disable

**Example:**
```python
import quilt3.admin.tabulator as admin_tabulator

# Enable open query for broader data access
admin_tabulator.set_open_query(True)
print("Open query mode enabled")

# Disable for stricter access control
admin_tabulator.set_open_query(False)
print("Open query mode disabled")
```

**Security Note:** Open query mode reduces access restrictions. Enable only when appropriate for your security model.

---

## Common Administrative Workflows

### User Onboarding Workflow

```python
import quilt3.admin.users as admin_users
import quilt3.admin.roles as admin_roles

def onboard_user(username: str, email: str, department: str):
    """Complete user onboarding workflow."""
    
    # 1. Verify role exists
    roles = admin_roles.list()
    dept_role = f"{department}-user"
    if not any(r.name == dept_role for r in roles):
        raise ValueError(f"Role {dept_role} not found")
    
    # 2. Create user
    user = admin_users.create(
        name=username,
        email=email,
        role=dept_role
    )
    
    # 3. Add standard roles
    admin_users.add_roles(username, ["package-viewer", "basic-search"])
    
    print(f"Successfully onboarded {username}")
    return user

# Usage
new_user = onboard_user("alice.johnson", "alice@company.com", "analytics")
```

### Role Audit and Cleanup

```python
import quilt3.admin.users as admin_users
from collections import defaultdict

def audit_user_roles():
    """Audit and report on user role assignments."""
    
    users = admin_users.list()
    role_usage = defaultdict(list)
    inactive_users = []
    
    for user in users:
        if not user.is_active:
            inactive_users.append(user.name)
            continue
            
        # Track primary role usage
        if user.role:
            role_usage[user.role.name].append(user.name)
            
        # Track extra role usage
        for role in user.extra_roles:
            role_usage[role.name].append(user.name)
    
    print("Role Usage Report:")
    for role_name, users in role_usage.items():
        print(f"  {role_name}: {len(users)} users")
    
    print(f"\nInactive users: {len(inactive_users)}")
    return role_usage, inactive_users

# Usage
role_report, inactive = audit_user_roles()
```

### Bulk User Management

```python
import quilt3.admin.users as admin_users
import csv

def bulk_user_update_from_csv(csv_file: str):
    """Update multiple users from CSV file."""
    
    with open(csv_file, 'r') as f:
        reader = csv.DictReader(f)
        
        for row in reader:
            username = row['username']
            action = row['action']
            
            try:
                if action == 'deactivate':
                    admin_users.set_active(username, False)
                elif action == 'activate':
                    admin_users.set_active(username, True)
                elif action == 'make_admin':
                    admin_users.set_admin(username, True)
                elif action == 'update_email':
                    admin_users.set_email(username, row['new_email'])
                    
                print(f"✓ {action} completed for {username}")
                
            except Exception as e:
                print(f"✗ Failed {action} for {username}: {e}")

# Usage with CSV file containing columns: username, action, new_email
bulk_user_update_from_csv("user_updates.csv")
```

## Error Handling and Best Practices

### Robust Error Handling

```python
import quilt3.admin.users as admin_users
from quilt3.admin.exceptions import UserNotFoundError, Quilt3AdminError

def safe_user_operation(username: str, operation: str):
    """Safely perform user operations with proper error handling."""
    
    try:
        if operation == "get":
            user = admin_users.get(username)
            if user is None:
                print(f"User {username} not found")
                return None
            return user
            
    except UserNotFoundError:
        print(f"User {username} does not exist")
    except Quilt3AdminError as e:
        print(f"Admin operation failed: {e}")
    except Exception as e:
        print(f"Unexpected error: {e}")
    
    return None
```

### Security Best Practices

1. **Principle of Least Privilege**: Assign minimal necessary roles
2. **Regular Audits**: Periodically review user roles and access
3. **Secure SSO**: Validate SAML configurations thoroughly
4. **Backup Admins**: Maintain multiple admin accounts
5. **Logging**: Monitor administrative actions
6. **Testing**: Test changes in staging environments first

### Performance Considerations

- Use `admin_users.get()` for single user lookups
- Cache role lists when performing bulk operations
- Batch user operations when possible
- Monitor API rate limits for large-scale operations

This comprehensive API reference provides the foundation for effective Quilt catalog administration through programmatic interfaces.