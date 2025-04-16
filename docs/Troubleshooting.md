# Troubleshooting

For Catalog-specific issues, see [Catalog Troubleshooting](Catalog/Troubleshooting.md).

## Missing metadata when working with Quilt packages via the API

> `Package.set_dir()` on the package root (".") overrides package-level
> metadata. If you do not provide `set_dir(".", foo, meta=baz)` with a value for
> `meta=`, `set_dir` will set package-level metadata to `None`.

A common pattern is to `Package.browse()` to get the most recent
version of a package, and then `Package.push()` updates.
You can preserve package-level metadata when calling `set_dir(".", ...)`
as follows:

<!--pytest.mark.skip-->
```python
import quilt3

p = quilt3.Package.browse(
    "user-packages/geodata", 
    registry="s3://bucket_1"
)

p.set_dir(
    ".",
    "s3://bucket_2/path/to/new/geofiles",
    meta=p.meta
)

# Push changes to the S3 registry
p.push(
    "user-packages/geodata",
    registry="s3://bucket_1",
    message="Updating package geodata source data"
)
```

- [Reference](https://docs.quilt.bio/api-reference/package#package.set_dir).

## User creation and log in

Users can either be invited directly or are _just-in-time provisioned (JIP)_
when they sign in via SSO and receive the "default role."

### Important conditions and pre-requisites

- If an admin (or any user) is created by JIP, or created through CloudFormation
with an SSO Provider set to anything other than Disabled, then setting the
password for that user has no effect and _password login will never succeed_ for
that user. Said another way, users created through SSO can only log in through
SSO.

- You _must disable SSO_ and enable `PasswordAuth` if you wish to log in as an
admin using a password (as opposed to SSO).

### Unable to log in

The following are common causes of failed logins. In most cases we recommend
that you check the browser's network panel
for details.

1. SSO connector misconfigured. See [SSO](technical-reference.md#cnames) for
   details.
1. SSL errors are often caused by misspelled names, or incomplete Subject
Alternate Names. The ACM certificate for `CertificateArnELB` must cover all
three Quilt [CNAMEs](technical-reference.md#cnames) either via a suitable `*` or
explicit Subject Alternate Names.

### Changing the admin email or password

Changing the admin password is only possible with `PasswordAuth=Enabled` in
CloudFormation and is subject to the following limitations for security reasons:

- Has no effect if SSO is in use, or was in use when the admin was first
  created.
- Has no effect on pre-existing admin username/password pairs.

You can click "reset password" on the login page.

To change the admin email (e.g. you have accidentally broken your admin user)
try the following:

1. Change the value of the `AdminEmail` CloudFormation parameter _to a net new
   email_.
1. Apply the change as a stack _Update_.
1. Once the update is successful, the new admin can log in, set roles, and
nominate other admins as needed.

## General stack update failure steps

On rare occasions, Quilt stack deployment updates might fail. This can happen
for several reasons. To expedite resolution of stack deployment issues, it's
helpful to have the following data and output from the following [AWS
CLI](https://aws.amazon.com/cli/) commands when contacting
<support@quiltdata.io>.

1. Quilt stack outputs:
    <!--pytest.mark.skip-->
    ```sh
    STACK_NAME="YOUR_QUILT_STACK"
    aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --query 'Stacks[].Outputs'
    ```

1. Initiate drift detection:
    <!--pytest.mark.skip-->
    ```sh
    aws cloudformation detect-stack-drift \
        --stack-name "$STACK_NAME"
    ```

1. _After drift detection is complete_:
    <!--pytest.mark.skip-->
    ```sh
    aws cloudformation describe-stack-resource-drifts \
        --stack-name "$STACK_NAME"
    ```

1. Quilt stack events:
    <!--pytest.mark.skip-->
    ```sh
    aws cloudformation describe-stack-events \
        --stack-name "$STACK_NAME"
    ```

## Collect logs to diagnose

To expedite the resolution of any errors encountered while using
Quilt, please capture the following logs and share them with
Quilt support:

### Elastic Container Service (ECS)

1. Find the name of your Quilt stack:
    <!--pytest.mark.skip-->
    ```sh
    aws cloudformation list-stacks
    ```

1. Capture Quilt log events for the last 30 minutes as follows:
    <!--pytest.mark.skip-->
    ```sh
    STACK_NAME="YOUR_QUILT_STACK"
    aws logs filter-log-events \
        --log-group-name "$STACK_NAME" \
        --start-time "$(( ($(date +%s) - 1800) * 1000 ))" \
        --end-time "$(( $(date +%s) * 1000 ))" > log-quilt-ecs-events.json
    ```

### IAM permissions

Determine which principal you're using as follows:
<!--pytest.mark.skip-->
```sh
aws sts get-caller-identity
```

### S3 objects

Inspect problematic objects with the following commands:
<!--pytest.mark.skip-->
```sh
BUCKET="YOUR_BUCKET"
PREFIX="YOUR_PREFIX"
aws s3api list-object-versions --bucket "$BUCKET" --prefix "$PREFIX"
aws s3api get-object-tagging --bucket "$BUCKET" --key "$PREFIX"
```

### Specific logical resources

Sometimes you may wish to find an ID or other information from a logical
resource in a Quilt stack. The following example is for security groups. Modify
the commands as needed for other resource types.

<!--pytest.mark.skip-->
```sh
STACK_NAME="YOUR_QUILT_STACK"
RESOURCE_ID="YOUR_LOGICAL_ID"
SG_ID=$(
  aws cloudformation describe-stack-resource \
    --stack-name "$STACK_NAME" \
    --logical-resource-id "$RESOURCE_ID" \
    --query 'StackResourceDetail.PhysicalResourceId' \
    --output text
)
aws ec2 describe-security-groups --group-ids "${SG_ID}"
```

### Event source mapping

The event source mapping is a Lambda resource that reads from SQS.
<!--pytest.mark.skip-->
```sh
STACK_NAME="YOUR_QUILT_STACK"
aws lambda get-event-source-mapping --uuid \
    $(aws cloudformation describe-stack-resource \
        --stack-name "$STACK_NAME" \
        --logical-resource-id LambdaFunctionEventSourceMapping \
        --query StackResourceDetail.PhysicalResourceId --output text)
```

### Remediation

If for some reason the event source mapping is disabled, it can be enabled as
follows.
<!--pytest.mark.skip-->
```sh
STACK_NAME="YOUR_QUILT_STACK"
aws lambda update-event-source-mapping --uuid \
    $(aws cloudformation describe-stack-resource \
        --stack-name "$STACK_NAME" \
        --logical-resource-id LambdaFunctionEventSourceMapping \
        --query StackResourceDetail.PhysicalResourceId \
        --output text) \
    --enabled
```
