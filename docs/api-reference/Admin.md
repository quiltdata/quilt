
# quilt3.admin.types


## ManagedRole(id: str, name: str, arn: str, typename\_\_: Literal['ManagedRole']) -> None  {#ManagedRole}


## UnmanagedRole(id: str, name: str, arn: str, typename\_\_: Literal['UnmanagedRole']) -> None  {#UnmanagedRole}


## User(name: str, email: str, date\_joined: datetime.datetime, last\_login: datetime.datetime, is\_active: bool, is\_admin: bool, is\_sso\_only: bool, is\_service: bool, role: Optional[Annotated[Union[quilt3.admin.types.ManagedRole, quilt3.admin.types.UnmanagedRole], FieldInfo(annotation=NoneType, required=True, discriminator='typename\_\_')]], extra\_roles: List[Annotated[Union[quilt3.admin.types.ManagedRole, quilt3.admin.types.UnmanagedRole], FieldInfo(annotation=NoneType, required=True, discriminator='typename\_\_')]]) -> None  {#User}


## SSOConfig(text: str, timestamp: datetime.datetime, uploader: quilt3.admin.types.User) -> None  {#SSOConfig}


## TabulatorTable(name: str, config: str) -> None  {#TabulatorTable}


## Bucket(name: str, title: str, icon\_url: Optional[str], description: Optional[str], overview\_url: Optional[str], tags: Optional[List[str]], relevance\_score: int, last\_indexed: Optional[datetime.datetime], sns\_notification\_arn: Optional[str], scanner\_parallel\_shards\_depth: Optional[int], skip\_meta\_data\_indexing: Optional[bool], file\_extensions\_to\_index: Optional[List[str]], index\_content\_bytes: Optional[int], prefixes: List[str]) -> None  {#Bucket}


# quilt3.admin.buckets


## get(name: str) -> Optional[quilt3.admin.types.Bucket]  {#get}

Get a specific bucket configuration from the registry.
Returns `None` if the bucket does not exist.

__Arguments__

* __name__:  Name of the bucket to get.


## list() -> list[quilt3.admin.types.Bucket]  {#list}

List all bucket configurations in the registry.


## add(name: str, title: str, \*, description: Optional[str] = None, icon\_url: Optional[str] = None, overview\_url: Optional[str] = None, tags: Optional[List[str]] = None, relevance\_score: Optional[int] = None, sns\_notification\_arn: Optional[str] = None, scanner\_parallel\_shards\_depth: Optional[int] = None, skip\_meta\_data\_indexing: Optional[bool] = None, file\_extensions\_to\_index: Optional[List[str]] = None, index\_content\_bytes: Optional[int] = None, delay\_scan: Optional[bool] = None, browsable: Optional[bool] = None, prefixes: Optional[List[str]] = None) -> quilt3.admin.types.Bucket  {#add}

Add a new bucket to the registry.

__Arguments__

* __name__:  S3 bucket name.
* __title__:  Display title for the bucket.
* __description__:  Optional description.
* __icon_url__:  Optional URL for bucket icon.
* __overview_url__:  Optional URL for bucket overview page.
* __tags__:  Optional list of tags.
* __relevance_score__:  Optional relevance score for bucket ordering.
* __sns_notification_arn__:  Optional SNS topic ARN for notifications.
* __scanner_parallel_shards_depth__:  Optional depth for parallel scanning.
* __skip_meta_data_indexing__:  If True, skip metadata indexing.
* __file_extensions_to_index__:  Optional list of file extensions to index content.
* __index_content_bytes__:  Optional max bytes of content to index.
* __delay_scan__:  If True, delay initial bucket scan.
* __browsable__:  If True, bucket is browsable.
* __prefixes__:  Optional list of S3 prefixes to scope bucket access to.
    If provided, only these prefixes will be indexed and verified for access.


## update(name: str, title: str, \*, description: Optional[str] = None, icon\_url: Optional[str] = None, overview\_url: Optional[str] = None, tags: Optional[List[str]] = None, relevance\_score: Optional[int] = None, sns\_notification\_arn: Optional[str] = None, scanner\_parallel\_shards\_depth: Optional[int] = None, skip\_meta\_data\_indexing: Optional[bool] = None, file\_extensions\_to\_index: Optional[List[str]] = None, index\_content\_bytes: Optional[int] = None, browsable: Optional[bool] = None, prefixes: Optional[List[str]] = None) -> quilt3.admin.types.Bucket  {#update}

Update an existing bucket configuration.

__Arguments__

* __name__:  S3 bucket name.
* __title__:  Display title for the bucket.
* __description__:  Optional description.
* __icon_url__:  Optional URL for bucket icon.
* __overview_url__:  Optional URL for bucket overview page.
* __tags__:  Optional list of tags.
* __relevance_score__:  Optional relevance score for bucket ordering.
* __sns_notification_arn__:  Optional SNS topic ARN for notifications.
* __scanner_parallel_shards_depth__:  Optional depth for parallel scanning.
* __skip_meta_data_indexing__:  If True, skip metadata indexing.
* __file_extensions_to_index__:  Optional list of file extensions to index content.
* __index_content_bytes__:  Optional max bytes of content to index.
* __browsable__:  If True, bucket is browsable.
* __prefixes__:  Optional list of S3 prefixes to scope bucket access to.
    If provided, only these prefixes will be indexed and verified for access.
    Changing prefixes will trigger permission re-verification.


## remove(name: str) -> None  {#remove}

Remove a bucket from the registry.

__Arguments__

* __name__:  Name of the bucket to remove.


# quilt3.admin.roles


## list() -> List[Union[quilt3.admin.types.ManagedRole, quilt3.admin.types.UnmanagedRole]]  {#list}

Get a list of all roles in the registry.


# quilt3.admin.users


## get(name: str) -> Optional[quilt3.admin.types.User]  {#get}

Get a specific user from the registry. Return `None` if the user does not exist.

__Arguments__

* __name__:  Username of user to get.


## list() -> List[quilt3.admin.types.User]  {#list}

Get a list of all users in the registry.


## create(name: str, email: str, role: str, extra\_roles: Optional[List[str]] = None) -> quilt3.admin.types.User  {#create}

Create a new user in the registry.

__Arguments__

* __name__:  Username of user to create.
* __email__:  Email of user to create.
* __role__:  Active role of the user.
* __extra_roles__:  Additional roles to assign to the user.


## delete(name: str) -> None  {#delete}

Delete user from the registry.

__Arguments__

* __name__:  Username of user to delete.


## set\_email(name: str, email: str) -> quilt3.admin.types.User  {#set\_email}

Set the email for a user.

__Arguments__

* __name__:  Username of user to update.
* __email__:  Email to set for the user.


## set\_admin(name: str, admin: bool) -> quilt3.admin.types.User  {#set\_admin}

Set the admin status for a user.

__Arguments__

* __name__:  Username of user to update.
* __admin__:  Admin status to set for the user.


## set\_active(name: str, active: bool) -> quilt3.admin.types.User  {#set\_active}

Set the active status for a user.

__Arguments__

* __name__:  Username of user to update.
* __active__:  Active status to set for the user.


## reset\_password(name: str) -> None  {#reset\_password}

Reset the password for a user.

__Arguments__

* __name__:  Username of user to update.


## set\_role(name: str, role: str, extra\_roles: Optional[List[str]] = None, \*, append: bool = False) -> quilt3.admin.types.User  {#set\_role}

Set the active and extra roles for a user.

__Arguments__

* __name__:  Username of user to update.
* __role__:  Role to be set as the active role.
* __extra_roles__:  Additional roles to assign to the user.
* __append__:  If True, append the extra roles to the existing roles. If False, replace the existing roles.


## add\_roles(name: str, roles: List[str]) -> quilt3.admin.types.User  {#add\_roles}

Add roles to a user.

__Arguments__

* __name__:  Username of user to update.
* __roles__:  Roles to add to the user.


## remove\_roles(name: str, roles: List[str], fallback: Optional[str] = None) -> quilt3.admin.types.User  {#remove\_roles}

Remove roles from a user.

__Arguments__

* __name__:  Username of user to update.
* __roles__:  Roles to remove from the user.
* __fallback__:  If set, the role to assign to the user if the active role is removed.


# quilt3.admin.sso_config


## get() -> Optional[quilt3.admin.types.SSOConfig]  {#get}

Get the current SSO configuration.


## set(config: Optional[str]) -> Optional[quilt3.admin.types.SSOConfig]  {#set}

Set the SSO configuration. Pass `None` to remove SSO configuration.


# quilt3.admin.tabulator


## list\_tables(bucket\_name: str) -> list[quilt3.admin.types.TabulatorTable]  {#list\_tables}

List all tabulator tables in a bucket.


## set\_table(bucket\_name: str, table\_name: str, config: Optional[str]) -> None  {#set\_table}

Set the tabulator table configuration. Pass `None` to remove the table.


## rename\_table(bucket\_name: str, table\_name: str, new\_table\_name: str) -> None  {#rename\_table}

Rename tabulator table.


## get\_open\_query() -> bool  {#get\_open\_query}

Get the **open query** status.


## set\_open\_query(enabled: bool) -> None  {#set\_open\_query}

Set the **open query** status.

