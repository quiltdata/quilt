<!-- markdownlint-disable -->
## Catalog Overview stats (objects, packages) seem incorrect or aren't updating
## Catalog Packages tab doesn't work
## Catalog packages or stats are missing or are not updating

If you recently added the bucket or upgraded the stack, if search volume is high,
or if read/write volume is high, wait a few minutes and try again.

### Re-index the bucket

1. Open the bucket overview in the Quilt catalog and click the gear icon (upper right),
or navigate to Admin settings > Buckets and inspect the settings of the bucket in question.

1. Under "Indexing and notifications", click "Re-index and Repair".

> Optionally: **if and only if** bucket notifications are not working and you are
> certain that there are no other subscribers to the S3 Events of the bucket in
> question, check "Repair S3 notifications".

Bucket packages, stats, and the search index will repopulate in the next few minutes.
Buckets with more than one million objects will take longer.

### Inspect the Elasticsearch domain

1. Determine your Quilt instance's ElasticSearch domain from Amazon Console > OpenSearch
or `aws opensearch list-domain-names`. Note the domain name (hereafter `QUILT_DOMAIN`).

1. Run the following command and save the output file:
    ```sh
    aws es describe-elasticsearch-domain --domain-name "$QUILT_DOMAIN" > quilt-es-domain.json
    ```

1. Visit Amazon Console > OpenSearch > `QUILT_DOMAIN` > Cluster health.

1. Set the time range as long as possible to fully overlap with your observed issues.

1. Screenshot the Summary, Overall Health, and Key Performance Indicator sections

1. Send the JSON output file and screenshots to [Quilt support](mailto:support@quiltdata.io).

> As a rule you should not reconfigure your Elasticsearch domain directly as this will
> result in stack drift that will be lost the next time you update your Quilt instance.

## Missing metadata when working with Quilt packages via the API

> `Package.set_dir()` on the package root (".") overrides package-level metadata.
> If you do not provide `set_dir(".", foo, meta=baz)` with a value for `meta=`,
> `set_dir` will set package-level metadata to `None`.

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

- [Reference](https://docs.quiltdata.com/api-reference/package#package.set_dir).

## "Session expired" notice in the Catalog

There are two reasons for encountering the "Session expired" notice
after clicking the `RELOAD` button in the Quilt Catalog.

1. Your browser cache is out of date, in which case you need to:
    1. Delete session storage
    1. Delete local storage
    1. Delete cookies
1. Your Quilt user Role has been corrupted. You will need a Quilt Admin
user to reset your Quilt user Role to a default (**and valid**) Role.


## User creation and log in
Users can either be invited directly or are _just-in-time provisioned (JIP)_ when
they sign in via SSO and receive the "default role."

### Important conditions and pre-requisites
* If an admin (or any user) is created by JIP, or created through CloudFormation
with an SSO Provider set to anything other than Disabled, then setting the password
for that user has no effect and _password login will never succeed_ for that user.
Said another way, users created through SSO can only log in through SSO.
* You _must disable SSO_ and enable `PasswordAuth` if you wish to log in as an admin
using a password (as opposed to SSO).

### Changing the admin via CloudFormation
If you need to change the admin (e.g. you have accidentally broken your admin user)
try the following:
1. Change the value of the `AdminEmail` CloudFormation parameter.
1. Apply the change as a stack _Update_.
1. Once the update is successful, the new admin can log in, set roles, and nominate
other admins as needed.

## General stack update failure steps
On rare occasions, Quilt stack deployment updates might fail. This can happen for several
reasons. To expedite resolution of stack deployment issues, it's helpful to 
have the following data and output from the following [AWS CLI](https://aws.amazon.com/cli/) 
commands when contacting support@quiltdata.io.

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

### Browser Network and Console

1. Go to the affected page in your Quilt Catalog.
1. Open the browser Developer tools:
    - Google Chrome: Press **F12**, **Ctrl+Shift+I** or from the
    Chrome menu select **More tools > Developer tools**.
1. Select the **Network** tab.
    1. Ensure the session is recorded:
        - Google Chrome: Check the red button in the upper left corner is set to **Record**.
    1. Ensure **Preserve Log** is enabled.
    1. Perform the action that triggers the error (e.g. clicking the `Download package` button).
    1. Export the logs as HAR format.
        - Google Chrome: **Ctrl + Click** anywhere on the grid of
        network requests and select **Save all as HAR with content**.
    1. Save the HAR-formatted file to your localhost.

        ![Save browser Network error logs as HAR content](imgs/troubleshooting-logs-browser.png)
1. Select the **Console** tab.
    1. Perform the action that triggers the error (e.g. clicking the `Download package` button).
    1. Export the logs.
        - Google Chrome: **Ctrl + Click** anywhere on the grid of
        network requests and select **Save as...**.
    1. Save the log file to your localhost.

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

Sometimes you may wish to find an ID or other information from a logical resource
in a Quilt stack. The following example is for security groups. Modify the commands as needed
for other resource types.

<!--pytest.mark.skip-->
```sh
STACK_NAME="YOUR_QUILT_STACK"
RESOURCE_ID="YOUR_LOGICAL_ID"
SG_ID=$(
  aws cloudformation describe-stack-resource \
    --stack-name "${STACK_NAME}" \
    --logical-resource-id "${RESOURCE_ID}" \
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

## Remediation

### Event source mapping
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
