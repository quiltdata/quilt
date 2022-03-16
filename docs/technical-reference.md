# Run Quilt in Your AWS Account
Quilt is a Data Hub for AWS.
A Quilt _instance_ is a private portal that runs in your virtual private cloud (VPC).

## Help and Advice

We encourage users to contact us before deploying Quilt.
We will make sure that you have the latest version of Quilt,
and walk you through the CloudFormation deployment.

We recommend that all users do one or more of the following:
* [Schedule a Quilt engineer](https://www.meetingbird.com/m/quilt-install)
to guide you through the installation

* [Join Quilt on Slack](https://slack.quiltdata.com/) to ask questions and
connect with other users

* [Email Quilt](mailto://contact@quiltdata.io)

## Architecture
Each instance consists of a password-protected web catalog on your domain,
backend services, a secure server to manage user identities, and a Python API.

![Architecture Diagram](https://quilt-web-public.s3.amazonaws.com/quilt-aws-diagram.png)

### Network
![](imgs/aws-diagram-network.png)
* ECS services (e.g., Catalog, Identity Server) run in two availability zones
with separate private subnets.
* Amazon RDS (Postgres) stores stack configuration settings only. It is
deployed in a multi-AZ configuration for high availability.
* Security groups and NACLs restrict access to the greatest degree possible, by
only allowing necessary traffic.

### Sizing
The Quilt CloudFormation template will automatically configure appropriate instance sizes for RDS, ECS (Fargate), Lambda and Elasticsearch Service. Some users may choose to adjust the size and configuration of their Elasticsearch cluster. All other services should use the default settings.

#### Elasticsearch Service Configuration
By default, Quilt configures an Elasticsearch cluster with 3 master nodes and 2 data nodes. Please contact the Quilt support team before adjusting the size and configuration of your cluster to avoid disruption.

### Cost
The infrastructure costs of running a Quilt stack vary with usage. Baseline infrastructure costs start at $620 and go up from there. See below for a breakdown of baseline costs for `us-east-1` at 744 hours per month.

| Service  | Cost |
| ------------- | ------------- |
| Elasticsearch Service | $516.83 |
| RDS  | $75.56 |
| ECS (Fargate) | $26.64 |
| Lambda | Variable |
| CloudTrail | Variable |
| Athena | Variable |
| **Total** | **$619.03 + Variable Costs** |

### Health and Monitoring
To check the status of your Quilt stack after bring-up or update, check the stack health in the CloudFormation console.

#### Elasticsearch Cluster
If you notice slow or incomplete search results, check the status of the Quilt Elasticsearch cluster. To find the Quilt search cluster from CloudFormation, click on the Quilt stack, then "Resources." Click on the "Search" resource.

If your cluster status is not "Green" (healthy), please contact Quilt support. Causes of unhealthy search clusters include:
* Running out of storage space
* High index rates (e.g., caused by adding or updating very large numbers of files in S3)

### Service Limits
This deployment does not require an increase in limits for your AWS Account.

## Requirements and Prerequisites

### Knowledge Requirements
Running Quilt requires working knowledge of [AWS CloudFormation](https://aws.amazon.com/cloudformation/), [AWS S3](https://aws.amazon.com/s3/) and [Elasticsearch Service](https://aws.amazon.com/elasticsearch-service/).

### Before you install Quilt

You will need the following:

1. **An AWS account**

1. **IAM Permissions** to run the CloudFormation template (or Add products in
Service Catalog).
The `AdministratorAccess` policy is sufficient. (Quilt creates and manages a
VPC, containers, S3 buckets, a database, and more.)

If you wish to create an [AWS CloudFormation service role](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/using-iam-servicerole.html)
for the installation, visit `IAM > Roles > Create Role > AWS service > CloudFormation`
in the AWS console.

The following service role is equivalent to `AdministratorAccess`:
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": "*",
            "Resource": "*"
        }
    ]
}
```

1. The **ability to create DNS entries**, such as CNAME records,
for your company's domain.

1. **An SSL certificate in the same region as your Quilt instance** to secure the domain where your users will access your Quilt instance.
For example, to make your Quilt catalog available at `https://quilt.mycompany.com`,
you require a certificate for either `*.mycompany.com` *or* for the following 3 domains:
`quilt.mycompany.com`, `quilt-registry.mycompany.com` and `quilt-s3-proxy.mycompany.com`
in the [AWS Certificate Manager](https://aws.amazon.com/certificate-manager/). 
You may either [create a new certificate](https://docs.aws.amazon.com/acm/latest/userguide/gs-acm-request-public.html), or
[import an existing certificate](https://docs.aws.amazon.com/acm/latest/userguide/import-certificate.html).
The ARN for this certificate or set of certificates is required for use as the `CertificateArnELB` CloudFormation parameter.

1. For maximum security, Quilt requires **a region that supports [AWS Fargate](https://aws.amazon.com/about-aws/global-infrastructure/regional-product-services/)**. As of this writing, all U.S. regions support Fargate.

1. **An S3 Bucket** for your team data. This may be a new or existing bucket.
The bucket should not have any notifications attached to it
(S3 Console > Bucket > Properties > Events).
Quilt will need to install its own notifications.
Installing Quilt will modify the following Bucket characteristics:
    * Permissions > CORS configuration (will be modified for secure web access)
    * Properties > Object-level logging (will be enabled)
    * Properties > Events (will add one notification)

Buckets in Quilt may choose to enable versioning or disable versioning.
**It is strongly recommended that you keep versioning either on or off during the entire lifetime
of the bucket**. Toggling versioning on and off incurs edge cases that may cause
bugs with any state that Quilt stores in ElasticSearch due to inconsistent semantics
of `ObjectRemoved:DeleteMarkerCreated`.

1. A **subdomain that is as yet not mapped in DNS** where users will access Quilt on the web. For example `quilt.mycompany.com`.

1. Available **CloudTrail Trails** in the region where you wish to host your stack
([learn more](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/WhatIsCloudTrail-Limits.html)).

1. A license key or an active subscription to Quilt Business on AWS Marketplace. Click `Continue to Subscribe` on the [Quilt Business Listing](https://aws.amazon.com/marketplace/pp/B07QF1VXFQ) to subscribe then return to this page for installation instructions. **The CloudFormation template and instructions on AWS Marketplace are infrequently updated and may be missing critical bugfixes.**

### AWS Marketplace

You can install Quilt via AWS Marketplace. As indicated above, we recommend that you [contact us first](#installation-instructions).


### AWS Service Catalog

1. Email [contact@quiltdata.io](mailto:contact@quiltdata.io)
with your AWS account ID to request access to Quilt through the 
AWS Service Catalog and to obtain a license key.

1. Click the service catalog link that you received from Quilt. Arrive at the Service Catalog.
Click IMPORT, lower right.

    ![](./imgs/import.png)

1. Navigate to Admin > Portfolios list > Imported Portfolios. Click Quilt Enterprise.

    ![](./imgs/portfolio.png)

1. On the Portfolio details page, click ADD USER, GROUP OR ROLE. Add any users,
**including yourself**, whom you would like to be able to install Quilt.

    ![](./imgs/portfolio-users.png)

1. Click Products list, upper left. Click the menu to the left of Quilt CloudFormation
Template. Click Launch product. (In the future, use the same menu to upgrade
Quilt when a new version is released.)

    ![](./imgs/products-list.png)

1. Continue to the [CloudFormation](#CloudFormation) section.
Note: the following screenshots may differ slightly fromm what
you see in Service Catalog.

### CloudFormation

1. Specify stack details in the form of a stack _name_ and CloudFormation
_parameters_. Refer to the descriptions displayed above each
text box for further details. Service Catalog users require a license key. See
[Before you install Quilt](#before-you-install-quilt) for how to obtain a license key.

    ![](./imgs/stack-details.png)

    If you wish to use a service role, specify it as follows:

    ![](./imgs/service-role.png)


1. Service Catalog users, skip this step. Under Stack creation options, enable termination protection.

    ![](./imgs/term_protect.png)

    This protects the stack from accidental deletion. Click Next.

1. Service Catalog users, skip this step. Check the box asking you to acknowledge that CloudFormation may create IAM roles, then click Create.

    ![](./imgs/finish.png)

1. CloudFormation takes about 30 minutes to create the resources
for your stack. You may monitor progress under Events.
Once the stack is complete, you will see `CREATE_COMPLETE` as the Status for
your CloudFormation stack.

    ![](./imgs/events.png)

1. To finish the installation, you will want to view the stack Outputs.

    ![](./imgs/outputs.png)

    In a separate browser window, open the DNS settings for your domain.
    Create the following `CNAME` records. **Replace italics** with the
    corresponding stack Outputs.

    | CNAME | Value |
    |------|-------|
    | _QuiltWebHost Key_  | _LoadBalancerDNSName_ | 
    | _RegistryHostName Key_  | _LoadBalancerDNSName_ |
    | _S3ProxyHost Key_  | _LoadBalancerDNSName_ | 

1. Quilt is now up and running. You can click on the _QuiltWebHost_ value
in Outputs and log in with your administrator password to invite users.

## Routine Maintainance and Upgrades

Major releases will be posted to AWS Marketplace. Minor releases will be announced via email and Slack. Join the [Quilt mailing list](http://eepurl.com/bOyxRz) or [Slack Channel](https://slack.quiltdata.com/) for updates.

To update your Quilt stack, apply the latest CloudFormation template in the CloudFormation console as follows.

1. Navigate to AWS Console > CloudFormation > Stacks
1. Select your Quilt stack
1. Click Update (upper right)
1. Choose Replace current template
1. Enter the Amazon S3 URL for your template
1. Click Next (several times) and proceed to apply the update

Your previous settings should carry over.

## Security

All customer data and metadata in Quilt is stored in S3. It may also be cached in Elasticsearch Service (show in red in the diagram below). No other services in the Quilt stack store customer data.

![](imgs/aws-diagram-customer-data.png)

We recommend using [S3 encryption](https://docs.aws.amazon.com/AmazonS3/latest/userguide/UsingEncryption.html) and [Elasticsearch Service encryption at rest](https://docs.aws.amazon.com/elasticsearch-service/latest/developerguide/encryption-at-rest.html) to provide maximum protection.

## Advanced configuration

The default Quilt settings are adequate for most use cases. The following section
covers advanced customization options.

### Setting default role

If your stack settings allow users signing up by themselves, you must set the
default role which will be assigned to all new users.
Users won't be able to sign up by themselves until the default role is set,
though they still can be invited by an admin via user management UI.

![](imgs/admin-set-default-role.png)

### Single sign-on (SSO)

#### Google

You can enable users on your Google domain to sign in to Quilt.
Refer to [Google's instructions on OAuth2 user agents](https://developers.google.com/identity/protocols/OAuth2UserAgent)
and create authorization credentials to identify your Quilt stack to Google's OAuth 2.0 server.

![](./imgs/google_console.png)

In the template menu (CloudFormation or Service Catalog), select Google under *User authentication to Quilt*. Enter the domain or domains of your Google apps account under *SingleSignOnDomains*. Enter the *Client ID* of the OAuth 2.0 credentials you created into the field labeled *GoogleClientId*

![](./imgs/google_auth.png)

#### Active Directory

1. Go to Azure Portal > Active Directory > App Registrations
1. Click New Registration
1. Name the app, select the Supported account types
1. Set a Redirect URI from a "Single-page application" to
`https://<QuiltWebHost>/oauth-callback`
1. Once the application has been created you will need both its Application
(client) ID and Directory (tenant) ID
1. Your `AzureBaseUrl` will be of the form
`https://ENDPOINT/TENANT_ID`. In most cases `ENDPOINT` is simply
`login.microsoftonline.com`. Reference
[Microsoft identity platform and OpenID Connect protocol](https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-protocols-oidc)
and
[National clouds](https://docs.microsoft.com/en-us/azure/active-directory/develop/authentication-national-cloud)
for further details. 
1. Go to App registrations > Your Quilt app > Authentication > Implicit grants
and hybrid flows, and check the box to issue ID tokens 
1. Proceed to [Enabling SSO](#enabling-sso-in-cloudformation)

![](./imgs/active-directory.png)

#### Okta

1. Go to Okta > Admin > Applications
1. Click `Add Application`
1. Select type `Web` 
1. Name the app `Quilt` or something similar
1. Configure the app as shown below
1. Add `<QuiltWebHost>` to `Login redirect URIs` and
`Initiate login URI`
1. Copy the `Client ID` to a safe place
1. Go to API > Authorization servers
1. You should see a default URI that looks something like this
`https://<MY_COMPANY>.okta.com/oauth2/default`; copy it to a
safe place
1. Proceed to [Enabling SSO](#enabling-sso-in-cloudformation)

![](./imgs/okta-sso-general.png)

#### OneLogin

1. Go to Administration : Applications > Custom Connectors
1. Click `New Connector`
    1. Name the connector *Quilt Connector* or something similar
    1. Set `Sign on method` to `OpenID Connect`
    1. Set `Login URL` to `https://<QuiltWebHost>/oauth-callback`
    1. Save
1. Go back to Applications > Custom Connectors
1. Click `Add App to Connector`
1. Save the app (be sure to save it for the Organization)
1. Go to Applications > Applications > *Your new app* > SSO
    1. Click SSO. Copy the *Client ID* and *Issuer URL V2* to a safe place.
1. Add *Your new app* to the users who need to access
Quilt
1. Proceed to [Enabling SSO](#enabling-sso-in-cloudformation)

![](./imgs/onelogin-connector.png)
![](./imgs/onelogin-sso.png)
![](./imgs/onelogin-users.png)

#### Enabling SSO in CloudFormation

Now you can connect Quilt to your SSO provider.
In the Quilt template
(AWS Console > CloudFormation > *Quilt stack* > Update >
Use current template > Next > Specify stack details), set the following parameters:

* *AuthType*: Enabled
* *AuthClientId*: *Client ID*
* *AuthBaseUrl*: *Issuer URL V2*

### Preparing an AWS Role for use with Quilt

These instructions document how to set up an existing role for use with Quilt. If the role you want to use doesn't exist yet, create it now. For guidance creating IAM roles, see: [IAM best practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html), and the [Principle of Least Privilege](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html#grant-least-privilege) 

Go to your Quilt stack in CloudFormation. Go to `Outputs`, then find `RegistryRoleARN` and copy its value. It should look something like this: `arn:aws:iam::000000000000:role/stackname-ecsTaskExecutionRole`.

Go to the IAM console and navigate to `Roles`. Select the role you want to use. Go to the `Trust Relationships` tab for the role, and select `Edit Trust Relationship`. The statement might look something like this:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    "... one or more statements"
  ]
}
```

Add an object to the beginning of the Statement array with the following contents:

```json
{
  "Effect": "Allow",
  "Principal": {
    "AWS": "$YOUR_REGISTRY_ROLE_ARN"
  },
  "Action": "sts:AssumeRole"
},
```

Note the comma after the object. Your trust relationship should now look something like this:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "$YOUR_REGISTRY_ROLE_ARN"
      },
      "Action": "sts:AssumeRole"
    },
    "... whatever was here before"
  ]
}
```

You can now configure a Quilt Role with this role (using the Catalog's admin panel, or `quilt3.admin.create_role`).

## Backup and Recovery

All data and metadata in Quilt is stored in S3. S3 data is automatically backed up (replicated across multiple available zones). To protect against accidental deletion or overwriting of data, we strongly recommend enabling object versioning for all S3 buckets connected to Quilt.

No data will be lost if a Quilt stack goes down. The Quilt search indexes will be automatically rebuilt when buckets are added to a new stack.

### Region Failure
To protect against data loss in the event of a region failure, enable
[S3 Bucket Replication](https://aws.amazon.com/s3/features/replication/) on all S3 buckets.

The time to restore varies with storage needs, but a <2-hour recovery time objective (RTO) and <15 minute recovery point objective (RPO) are generally possible.

To restore Quilt in your backup region:
1. Create a new Quilt stack from the same CloudFormation template in the backup region.
1. Connect the replica buckets (in the backup region) to your Quilt stack. In the Quilt catalog, select "Users and Buckets"->"Buckets" and enter the bucket information.

## Emergency Maintainance
See [Troubleshooting](Troubleshooting.md)

## Support
Support is available to all Quilt customers by:
* online chat (in the Quilt catalog)
* email to [support@quiltdata.io](mailto://support@quiltdata.io)
* [Slack](https://slack.quiltdata.com/)

Quilt guarantees response to support issues according to the following SLAs for Quilt Business and Quilt Enterprise customers.

### Quilt Business
|  | Initial Response | Temporary Resolution |
| ---- | ---- | ----- |
| Priority 1 | 1 business day | 3 business days |
| Priority 2 | 2 business days | 5 business days |
| Priority 3 | 3 business days | N/A |

### Quilt Enterprise
|  | Initial Response | Temporary Resolution |
| ---- | ---- | ----- |
| Priority 1 | 4 business hours | 1 business day |
| Priority 2 | 1 business day | 2 business days |
| Priority 3 | 1 business days | N/A |

### Definitions
*	*Business Day* means Monday through Friday (PST), excluding holidays observed by Quilt Data.
*	*Business Hours* means 8:00 a.m. to 7:00 p.m. (PST) on Business Days.
*	*Priority 1* means a critical problem with the Software in which the Software
inoperable;
*	*Priority 2* means a problem with the Software in which the Software is
severely limited or degraded, major functions are not performing properly, and
the situation is causing a significant impact to Customer’s operations or
productivity;
*	*Priority 3* means a minor or cosmetic problem with the Software in which any of the following occur: the problem is an irritant, affects nonessential
functions, or has minimal impact to business operations; the problem is
localized or has isolated impact; the problem is an operational nuisance; the
problem results in documentation errors; or the problem is any other problem
that is not a Priority 1 or a Priority 2, but is otherwise a failure of the
Software to conform to the Documentation or Specifications;
* *Temporary Resolution* means a temporary fix or patch that has been
implemented and incorporated into the Software by Quilt Data to restore
Software functionality.
