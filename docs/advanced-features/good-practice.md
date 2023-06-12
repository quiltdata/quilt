<!-- markdownlint-disable -->
# Good-practice (GxP) and Quilt

## Overview

GxP is the [general abbreviation](https://en.wikipedia.org/wiki/GxP)
for "Good x Practice", where the "x" represents the domain that the
guidelines and regulations apply to. Together the regulations
constitute a collection of quality guidelines for the bio/pharmaceutical
industries.

As a decentralized data platform for your organization, Quilt
provides a series of operational quality metrics through a *status
monitoring system*.

## Status monitoring

### Architectural overview

The Quilt status monitoring system consists of four parts:

1. *Canaries:* A collection of end-to-end quality tests for key
operational functionality provided by Quilt. They are run on a
schedule in your AWS infrastructure.
2. *Status reports:* Simple HTML files generated on a daily schedule
by an AWS Lambda function (`status_reports`) and stored in a dedicated
Amazon S3 bucket. The HTML files contain the most recent canary run
results (Operational Qualification) and Quilt instance Cloud Formation
parameters and outputs (Infrastructure Qualification).
  1. Operational Qualification report: all canary test results and
  status (historical and current)
  2. Infrastructue Qualification report: all CloudFormation parameters
  and status
3. *Administrative User Interface:* An HTML page in the Quilt catalog
that displays the current operational status of a Quilt instance
and provides access to current and historical status reports.
4. *Amazon SNS topic:* Users can subscribe to the topic and recieve
canary error notifications (available as `CanaryNotificationsTopic`
stack output).

![](../imgs/catalog-status-example-status-report.png)

### Setting up status monitoring for a Quilt instance

In order to enable status monitoring for a Quilt instance, the
following conditions must be met:

- The Quilt instance CloudFormation template must have canaries
enabled
- The correct template parameters must be provided during the Quilt instance
CloudFormation deployment

The required Quilt and AWS resources are provisioned automatically
by the Quilt deployment.

#### List of canaries

There are currently four end-to-end quality tests:

- `BucketAccessControl`: Test that Users can only access specifically
allowed Amazon S3 buckets
- `Immutable URIs`: Test to resolve immutable Quilt URIs
- `PackagePushUi`: Test package `push` functionality via Quilt
catalog package creation dialog
- `Search`: Search S3 objects and Quilt packages in the Quilt catalog

#### Quilt instance CloudFormation deployment parameters

When deploying a Quilt instance using a CloudFormation template
with canaries enabled, you will have to provide the following
parameters:

- `CanaryNotificationsEmail` (if enabled): A valid email address
to send canary failure and error notifications

### Accessing current operational status and reports archive

Go to your Quilt web-based catalog administration panel, "Status"
tab (under the /admin/status URL).
There you can see the stack's current operational status (as well
as the chart with historic data for the last month) and the reports
table (which can be sorted / filtered) where you can preview or
download stored reports (HTML files).

![](../imgs/catalog-status-overview.png)

### Getting notifications about canary failures

For convenience, the following canary-related events are forwarded
to an SNS topic (available as `CanaryNotificationsTopic` in the
Quilt instance CloudFormation deployment Outputs tab):

1. A canary entering error state
2. A canary run failure

Quilt administrators can subscribe to this SNS topic to receive
these event notifications and process them appropriately (e.g. notifying first
responders or sending to incident management systems).

If enabled (see set-up instructions above), these events will be
also sent as emails to the configured address (`CanaryNotificationsEmail`
CloudFormation template parameter).


## Audit Trail

GPT-BS intro (to be further edited):

Audit trails in this system serve as integral components of the overall data governance strategy.
They document critical operations spanning across various facets, including authentication,
resource management, user administration, and interactions with key features like buckets.
These trails, logging a chronological sequence of activities, ensure traceability and accountability.
They facilitate a transparent system inspection, enhancing security, aiding in incident investigations,
and meeting regulatory compliance under Good Practices (GxP) standards.
By providing an immutable record of all significant events, the audit trail system
forms a vital part of our commitment to operational excellence and integrity.

### Audit Events

Audit events are stored as JSON records in JSONL files in a special audit trail bucket.

#### Event Structure

##### `eventVersion: int`, `eventRevision: int` (required, since 1.0)

Version and revision of the event record.

We increment the version on backwards-incompatible changes to the schema,
e.g. removing a JSON field that already exists, or changing how the contents of
a field are represented (for example, a date format).

We increment the revision on backwards-compatible changes, such as
adding new fields to the event structure.

In the context of this document, these together are referenced as `${eventVersion}.${eventRevision}`,
e.g. `since 1.0` means the event is available since version 1, revision 0.

##### `eventTime: datetime` (required, since 1.0)

The date and time the action was completed, in coordinated universal time (UTC).

##### `eventID: str` (required, since 1.0)

A unique ID (UUID) of the event.

##### `eventSource: "QuiltServer" | "QuiltScript"` (required, since 1.0)

The service / part of the system this event originates from.
This can be the one of the following values:

- `QuiltServer`: Quilt API Server.

- `QuiltScript`: A management script (this usually happens on stack bring-up / upgrade).

##### `eventType: "QuiltApiCall" | "QuiltScriptInvocation"` (required, since 1.0)

The type of event that generated the event record.
This can be the one of the following values:

- `QuiltApiCall`: An API called (GraphQL query or HTTP endpoint).

- `QuiltScriptInvocation`: A management script invoked (usually on stack bring-up / upgrade).

##### `eventName: str` (required, since 1.0)

The name of action performed, in form of `${namespace}.${operationName}`, e.g. `Users.Create`.
See **Event Taxonomy** for details.

##### `userAgent: str` (optional, since 1.0)

The agent through which the request was made, such as a web browser or Quilt Python Client.

##### `sourceIPAddress: str` (optional, since 1.0)

The IP address that the request was made from.

##### `userIdentity: UserIdentity` (required, since 1.0)

Information about the identity that performed the action.
Refer to **UserIdentity** section below for details.

##### `requestParameters: JSON object` (required, since 1.0)

The parameters, if any, that were sent with the request.
These parameters are documented below in the **Event Taxonomy** section.

##### `responseElements: any` (optional, since 1.0)

The response data, if any.

##### `errorCode: str` (optional, since 1.0)

Only present if an error occured while trying to perform an action,
`null` when the action succeeds.

##### `errorMessage: str` (optional, since 1.0)

Description of the error.

##### `additionalEventData: JSON object` (optional, since 1.0)

Additional data about the event that was not part of the request or response.

#### User Identity

All `UserIdentity` variants are stored as JSON objects and expose the `type` field.
Other fields vary based on the type of the recorded user identity.

##### `QuiltUser`

Represents a Quilt User.

Attributes:

- `type: "QuiltUser"`

- `id: str`

- `userName: str`

- `email: str`

- `isAdmin: bool`

- `isActive: bool`

- `isSsoOnly: bool`

- `isService: bool`

- `lastLogin: datetime`

- `dateJoined: datetime`

- `roleId: str` (optional): An ID of the associated Quilt Role.

##### `Unidentified`

Represents a user we were unable to identify.

Attributes:

- `type: "Unidentified"`

##### `IAMUser`

Represents an AWS/IAM user (e.g. when ECS invokes a management script).
Records the data returned by [`sts:GetCallerIdentity`](https://docs.aws.amazon.com/STS/latest/APIReference/API_GetCallerIdentity.html).

Attributes:

- `type: "IAMUser"`

- `account: str`: The AWS account ID number of the account that owns or contains the calling entity.

- `id: str`: The unique identifier of the calling entity.

- `arn: str`: The AWS ARN associated with the calling entity.

#### Examples

#### Event Taxonomy

See the GraphQL schema for GraphQL type reference.

#### `Buckets` namespace

##### `Buckets.Add` (GraphQL: `Mutation.bucketAdd`)

Bucket added to the stack.

##### `Buckets.Update` (GraphQL: `Mutation.bucketUpdate`)

Bucket settings updated.

##### `Buckets.Remove` (GraphQL: `Mutation.bucketRemove`)

Bucket removed from the stack.

#### `Policies` namespace

##### `Policies.Create` (GraphQL: `Mutation.policyCreateManaged` / `Mutation.policyCreateUnmanaged`)

Quilt Policy created.

`requestParameters.managed` is set accordingly.

##### `Policies.Update` (GraphQL: `Mutation.policyUpdateManaged` / `Mutation.policyUpdateUnmanaged`)

Quilt Policy updated.

`requestParameters.managed` is set accordingly.

##### `Policies.Delete` (GraphQL: `Mutation.policyDelete`)

Quilt Policy deleted.

#### `Roles` namespace

##### `Roles.Create` (GraphQL: `Mutation.roleCreateManaged` / `Mutation.roleCreateUnmanaged`)

Quilt Role created.

`requestParameters.managed` is set accordingly.

##### `Roles.Update` (GraphQL: `Mutation.roleUpdateManaged` / `Mutation.roleUpdateUnmanaged`)

Quilt Role updated.

`requestParameters.managed` is set accordingly.

##### `Roles.Delete` (GraphQL: `Mutation.roleDelete`)

Quilt Role deleted.

##### `Roles.SetDefault` (GraphQL: `Mutation.roleSetDefault`)

Quilt Role set as default.

#### `Auth` namespace

##### `Auth.RefreshToken`

Authentication token refreshed.

- `request_parameters`:
  - `refresh_token: "***"`

- `responseElements`:
  - `access_token: "***"`
  - `refresh_token: "***"`
  - `expires_at: datetime`

- `additionalEventData`:
  - `method: "code" | "refresh"`

##### `Auth.Login`

User logged in.

- `requestParameters`
  - `provider: str` (when `method` is `oauth`)
  - `code: str` (when `method` is `oauth`)
  - `username: str` (when `method` is `password`)
  - `password: "***"` (when `method` is `password`)

- `additionalEventData`
  - `method: "oauth" | "password"`
  - `account_id: str` (when `method` is `oauth`)
  - `email: str` (when `method` is `oauth`)
  - `user_created: true` (when `method` is `oauth` and new user was created)
  - `account_linked: true` (when `method` is `oauth` and existing user was linked with a new OAuth identity)

- `responseElements`
  - `access_token: "***"`
  - `refresh_token: "***"`
  - `exp: datetime`


##### `Auth.ServiceLogin`

A service user (Canary) logged in.

- `requestParameters`
  - `provider: str`
  - `token: "***"`

- `additionalEventData`
  - `account_id: str`

- `responseElements`
  - `access_token: "***"`
  - `refresh_token: "***"`
  - `exp: datetime`

##### `Auth.Activate`

A user activated.

##### `Auth.PasswordResetRequest`

Password reset requested.

- `requestParameters`
  - `email: str`

##### `Auth.PasswordChange`

User password changed.

- `requestParameters`
  - `password: "***"`
  - `link: "***"`

##### `Auth.Register`

User signed up.

- `requestParameters`
  - `username: str`
  - `email: str`
  - `password: "***"`

- `additionalEventData`
  - `default_role_id: str`

##### `Auth.Logout`

User signed out.

##### `Auth.IssueCode`

OAuth code issued (??).

- `responseElements`
  - `code`
    - `user_id: str`
    - `code: str`
    - `expires: datetime`
    - `sso_provider: str`
    - `sso_access_token: "***"`
    - `sso_refresh_token: "***"`
    - `sso_expires: datetime`

##### `Auth.GetAWSCredentials`

AWS credentials issued for a Quilt user.

- `responseElements`
  - `AccessKeyId: str`
  - `SecretKey: "***"`
  - `SessionToken: "***"`

#### `Users` namespace

Only accessible by the admin users.

##### `Users.List`

List users.

- `responseElements`
  - a list of
    - `username: str`
    - `email: str`
    - `date_joined: datetime`
    - `last_login: datetime`
    - `is_superuser: bool`
    - `is_active: bool`
    - `role_id: str`

##### `Users.Create`

User created.

- `requestParameters`
  - `username: str`
  - `email: str`

##### `Users.Disable`

User disabled.

- `requestParameters`
  - `username: str`

##### `Users.Enable`

User enabled.

- `requestParameters`
  - `username: str`

##### `Users.EditEmail`

User's email changed.

- `requestParameters`
  - `username: str`
  - `email: str`

##### `Users.GrantAdmin`

User is granted with admin rights.

- `requestParameters`
  - `username: str`

##### `Users.RevokeAdmin`

User is revoked admin rights.

- `requestParameters`
  - `username: str`

##### `Users.RevokeAdmin`

User deleted.

- `requestParameters`
  - `username: str`

##### `Users.ResetPassword`

User's password reset.

- `requestParameters`
  - `username: str`

##### `Users.SetRole`

User's role updated.

- `requestParameters`
  - `username: str`
  - `role: str` (Role name)

#### `Script` namespace

description and shared fields TBD

##### `Scripts.CreateAdmin`

TBD

##### `Scripts.CreateRole`

TBD

##### `Scripts.FixPackageEventsQueueSubscriptions`

TBD

##### `Scripts.SetupCanaries`

TBD

##### `Scripts.UpdateBucketPolicies`

TBD

### Querying With Athena

TBD
