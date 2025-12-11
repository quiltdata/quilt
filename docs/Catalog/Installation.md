<!--pytest-codeblocks:skipfile-->

# Catalog Installation

Quilt is a data mesh that verifies the integrity of your data so that teams can
find, understand, and file discoveries based on data of any size or in any format.

A Quilt _instance_ is a private portal that runs in your virtual private cloud (VPC).

Quilt supports multiple deployment methods including CloudFormation,
AWS Marketplace, and Terraform.

## Help and Advice

We encourage users to contact us before deploying Quilt.
We will make sure that you have the latest version of Quilt,
and walk you through the CloudFormation deployment.

We recommend that all users do one or more of the following:

* [Schedule a Quilt engineer](https://calendly.com/d/g6f-vnd-qf3/engineering-team)
to guide you through the installation

* [Join Quilt on Slack](https://slack.quiltdata.com/) to ask questions and
connect with other users

* [Email Quilt](mailto:contact@quiltdata.io)

## Requirements and Prerequisites

### Knowledge Requirements

Running Quilt requires working knowledge of [AWS CloudFormation](https://aws.amazon.com/cloudformation/),
[AWS S3](https://aws.amazon.com/s3/) and [Elasticsearch Service](https://aws.amazon.com/elasticsearch-service/).

### Before you install Quilt

You will need the following:

1. **An AWS account**.
    1. **The service-linked role for Elasticsearch**
    > This role is not created automatically when you use Cloudformation or other
    > APIs.

    You can create the role as follows:

    ```bash
    aws iam create-service-linked-role --aws-service-name es.amazonaws.com
    ```

1. **IAM Permissions** to create the CloudFormation stack (or Add products in
Service Catalog).
    1. You may choose to use a
    [CloudFormation service role](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/using-iam-servicerole.html)
    for stack creation and updates.
    1. Refer to this [example service role](../cfn-service-role.yaml)
    and modify as needed to fit your use case.

    > Ensure that your service role is up-to-date with the example before every
    stack update so as to prevent installation failures.

1. The **ability to create DNS entries**, such as CNAME records,
for your company's domain.
1. **An SSL certificate in the same region as your Quilt instance** to secure the
domain where your users will access your Quilt instance.
    1. For example, to make your Quilt catalog available at `https://quilt.mycompany.com`,
    you require a certificate for either `*.mycompany.com` _or_ for the following
    3 domains: `quilt.mycompany.com`, `quilt-registry.mycompany.com` and `quilt-s3-proxy.mycompany.com`
    in the [AWS Certificate Manager](https://aws.amazon.com/certificate-manager/).
    1. You may either [create a new certificate](https://docs.aws.amazon.com/acm/latest/userguide/gs-acm-request-public.html),
    or [import an existing certificate](https://docs.aws.amazon.com/acm/latest/userguide/import-certificate.html).
    1. The ARN for this certificate or set of certificates is required for use
    as the `CertificateArnELB` CloudFormation parameter.
1. For maximum security, Quilt requires **a region that supports
[AWS
Fargate](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/AWS_Fargate-Regions.html#linux-regions)**.
As of this writing, all U.S. regions support Fargate.
1. **An S3 Bucket** for your team data. This may be a new or existing
bucket. The bucket should not have any notifications attached to
it (`S3 Console > Bucket > Properties > Events`). Quilt will need
to install its own notifications. Installing Quilt will modify the
following Bucket characteristics:
    1. Properties > Object-level logging (will be enabled).
    1. Properties > Events (will add one notification).

    > Buckets in Quilt may choose to enable versioning or disable versioning.
    **It is strongly recommended that you keep versioning either on or off during
    the entire lifetime of the bucket**. Toggling versioning on and off incurs
    edge cases that may cause bugs with any state that Quilt stores in
    ElasticSearch due to inconsistent semantics of `ObjectRemoved:DeleteMarkerCreated`.

1. Available **CloudTrail Trails** in the region where you wish to host your stack
([learn more](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/WhatIsCloudTrail-Limits.html)).
1. A license key or an active subscription to Quilt Business on AWS Marketplace.
    1. Click `Continue to Subscribe` on the [Quilt Business Listing](https://aws.amazon.com/marketplace/pp/B07QF1VXFQ)
    to subscribe then return to this page for installation instructions.
    1. **The CloudFormation template and instructions on AWS Marketplace are
    infrequently updated and may be missing critical bugfixes.**

## Installation Methods

### AWS Marketplace

You can install Quilt via AWS Marketplace. As indicated above, we
recommend that you [contact us first](#help-and-advice).

### AWS Service Catalog

1. Email [contact@quiltdata.io](mailto:contact@quiltdata.io)
with your AWS account ID to request access to Quilt through the
AWS Service Catalog and to obtain a license key.
1. Click the service catalog link that you received from Quilt.
Arrive at the Service Catalog. Click IMPORT, lower right.

    ![Import portfolio page](../imgs/import.png)

1. Navigate to Admin > Portfolios list > Imported Portfolios. Click Quilt Enterprise.

    ![Portfolio page](../imgs/portfolio.png)

1. On the Portfolio details page, click ADD USER, GROUP OR ROLE. Add any users,
**including yourself**, whom you would like to be able to install Quilt.

    ![Portfolio users page](../imgs/portfolio-users.png)

1. Click Products list, upper left. Click the menu to the left of Quilt CloudFormation
Template. Click Launch product. (In the future, use the same menu to upgrade
Quilt when a new version is released.)

    ![Products list page](../imgs/products-list.png)

1. Continue to the [CloudFormation](#cloudformation) section.
Note: the following screenshots may differ slightly from what
you see in Service Catalog.

### CloudFormation

You can perform stack update and creation with the AWS Console, AWS CLI,
Terraform, or other means.

In all cases it is **highly recommended** that you set the `--on-failure` policy
to `ROLLBACK` so as to avoid incomplete rollback and problematic stack states.
In the AWS Console this option appears under the phrase "Stack failure options."

1. Specify stack details in the form of a stack _name_ and CloudFormation
_parameters_. Refer to the descriptions displayed above each
text box for further details. Service Catalog users require a license key. See
[Before you install Quilt](#before-you-install-quilt) for how to obtain
a license key.

    ![Stack details page](../imgs/stack-details.png)

1. If you wish to use a service role, specify it as follows:

    ![Specifying stack role](../imgs/service-role.png)

1. Service Catalog users, skip this step. Under Stack creation
options, enable termination protection. This protects the stack
from accidental deletion. Click Next.

    ![Enabling stack protection](../imgs/term_protect.png)

1. Service Catalog users, skip this step. Check the box asking you
to acknowledge that CloudFormation may create IAM roles, then click
Create.

    ![Confirmation page](../imgs/finish.png)

1. CloudFormation may take between 30 and 90 minutes to create your stack.
You can monitor progress under Events. On completion you will see `CREATE_COMPLETE`.

    ![Stack events page](../imgs/events.png)

1. To finish the installation, you will want to view the stack Outputs.

    ![Stack outputs page](../imgs/outputs.png)

### Terraform

You can also install Quilt using [Terraform](https://developer.hashicorp.com/terraform),
which enables more granular infrastructure-as-code control.

Terraform users **must** request a compatible CloudFormation template from Quilt:

> Contact your account manager to obtain a template that works with Terraform and
includes necessary variables.

1. Set up your project directory as follows:

    ```bash
    quilt_stack/
    ├── main.tf
    └── my-company.yml
    ```

    Use [examples/main.tf](https://github.com/quiltdata/iac/blob/main/examples/main.tf)
    as a template.

2. Define your AWS profile:

    ```bash
    export AWS_PROFILE=your-profile-name
    ```

3. Initialize Terraform:

    ```bash
    terraform init
    ```

4. Plan and apply:

    ```bash
    terraform plan -out=tfplan
    terraform apply tfplan
    ```

5. Use `terraform output` to obtain values such as the admin password or
endpoint URLs.

**Note:** We recommend using [remote state](https://developer.hashicorp.com/terraform/language/state/remote)
and not storing passwords in version control.

> For detailed configuration options, including search sizing and common pitfalls,
see the [Terraform README](https://github.com/quiltdata/iac/blob/main/README.md).

### CNAMEs

In order for your users to reach the Quilt catalog you must set three CNAMEs
that point to the `LoadBalancerDNSName` as shown below and in the Outputs
of your stack.

| CNAME | Value |
| ------ | ------- |
| `<QuiltWebHost>` Key | `LoadBalancerDNSName` |
| `<RegistryHostName>` Key | `LoadBalancerDNSName` |
| `<S3ProxyHost>` Key | `LoadBalancerDNSName` |

Quilt is now up and running. You can click on the _QuiltWebHost_ value
in Outputs and log in with your administrator password to invite users.

## Routine Maintenance and Upgrades

Releases are sent to customers over email. We recommend that you apply new releases
as soon as possible to benefit from the latest security updates and features.

### CloudFormation updates

To update your Quilt stack, apply the latest CloudFormation template in the
CloudFormation console as follows.

> By default, previous parameter values carry over.

1. Navigate to AWS Console > CloudFormation > Stacks
1. Select your Quilt stack
1. Click Update (upper right)
1. Choose Replace current template
1. Enter the Amazon S3 URL for your template
1. Click Next (several times) and proceed to apply the update

### Terraform updates

> See above.

## Upgrading from network 1.0 to network 2.0

Upgrading to the Quilt 2.0 network configuration provides improved security by means
of isolated subnets and a preference for private routing.

An upgrade to the 2.0 network, unlike routine Quilt upgrades, requires you to create
a new stack with a new load balancer. You must therefore also update your
[CNAMEs](#cnames) to point to the new load balancer.

## Create a new stack with an existing configuration

Terraform users can create a new Quilt stack with the same configuration as an existing
stack. This is typically useful when upgrading to the 2.0 network.

> _Configuration_ refers to the Quilt stack buckets, roles, policies,
> and other administrative settings, all of which are stored in RDS.

Perform the following steps:

1. Contact your Quilt account manager for a template that supports Terraform.

1. Take a manual snapshot of the current Quilt database instance. For an existing
Quilt stack this resource has the logical ID "DB". Note the snapshot identifier
("Snapshot name" in the AWS Console, `DBSnapshotIdentifier` in the following
AWS CLI command):

    <!--pytest.mark.skip-->
    ```sh
    aws rds describe-db-snapshots
    ```

    > Be sure to take a _manual_ snapshot. Do not rely on automatic snapshots,
    > which are deleted when the parent stack is deleted.

1. Apply the [quilt Terraform module](https://github.com/quiltdata/iac)
to your new template and provide the snapshot identifier to the
`db_snapshot_identifier=` argument.

    > You must use a Quilt CloudFormation template that supports an existing database,
    > existing search domain, and existing vpc in order for the terraform modules
    > to function properly.

1. You now have a new Quilt stack with a configuration equivalent to your prior
stack.
Verify that the new stack is working as desired. Delete the old stack.
