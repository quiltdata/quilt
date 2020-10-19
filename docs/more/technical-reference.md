# Enterprise install

Quilt is a versioned data portal for AWS. A Quilt _instance_ is a private portal that runs in your virtual private cloud \(VPC\). Each instance consists of a password-protected web catalog on your domain, backend services, a secure server to manage user identities, and a Python API.

## Installation Instructions

We encourage users to contact us before deploying Quilt. We will make sure that you have the latest version of Quilt, and walk you through the CloudFormation deployment.

We recommend that all users do one or more of the following:

* [Schedule a Quilt engineer](https://www.meetingbird.com/m/quilt-install) to guide you through the installation
* [Join Quilt on Slack](https://slack.quiltdata.com/) to ask questions and connect with other users
* [Email Quilt](mailto://contact@quiltdata.io)

## Before you install Quilt

You will need the following:

1. **An AWS account**
2. **IAM Permissions** to run the CloudFormation template \(or Add products in Service Catalog\). The `AdministratorAccess` policy is sufficient. \(Quilt creates and manages a VPC, containers, S3 buckets, a database, and more.\) If you wish to create a service role for the installation, visit `IAM > Roles > Create Role > AWS service > CloudFormation` in the AWS console. The following service role is equivalent to `AdministratorAccess`:

   ```javascript
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

3. The **ability to create DNS entries**, such as CNAME records, for your company's domain.
4. **An SSL certificate in the same region as your Quilt instance** to secure the domain where your users will access your Quilt instance. For example, to make your Quilt catalog available at `https://quilt.mycompany.com`, you require a certificate for `*.mycompany.com` in the [AWS Certificate Manager](https://aws.amazon.com/certificate-manager/). You may either [create a new certificate](https://docs.aws.amazon.com/acm/latest/userguide/gs-acm-request-public.html), or [import an existing certificate](https://docs.aws.amazon.com/acm/latest/userguide/import-certificate.html).
5. For maximum security, Quilt requires **a region that supports** [**AWS Fargate**](https://aws.amazon.com/about-aws/global-infrastructure/regional-product-services/). As of this writing, all U.S. regions support Fargate.
6. **An S3 Bucket** for your team data. This may be a new or existing bucket. The bucket should not have any notifications attached to it \(S3 Console &gt; Bucket &gt; Properties &gt; Events\). Quilt will need to install its own notifications. Installing Quilt will modify the following Bucket characteristics:
   * Permissions &gt; CORS configuration \(will be modified for secure web access\)
   * Properties &gt; Object-level logging \(will be enabled\)
   * Properties &gt; Events \(will add one notification\)

Buckets in Quilt may choose to enable versioning or disable versioning, but it is recommended that you avoid enabling versioning followed by disabling versioning as this can cause bugs in the object statistics for the bucket, shown in the Quilt catalog, due to inconsistent semantics of `ObjectRemoved:DeleteMarkerCreated`.

1. A **subdomain that is as yet not mapped in DNS** where users will access Quilt on the web. For example `quilt.mycompany.com`.
2. Available **CloudTrail Trails** in the region where you wish to host your stack \([learn more](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/WhatIsCloudTrail-Limits.html)\).
3. An active subscription to Quilt Business on AWS Marketplace. Click `Continue to Subscribe` on the [Quilt Business Listing](https://aws.amazon.com/marketplace/pp/B07QF1VXFQ) to subscribe then return to this page for installation instructions. **The CloudFormation template and instructions on AWS Marketplace are infrequently updated and may be missing critical bugfixes.**

### AWS Marketplace

You can install Quilt via AWS Marketplace. As indicated above, we recommend that you [contact us first](technical-reference.md#installation-instructions).

### AWS Service Catalog

1. Email [contact@quiltdata.io](mailto:contact@quiltdata.io) with your AWS account ID to request access to Quilt through the AWS Service Catalog and to obtain a license key.
2. Click the service catalog link that you received from Quilt. Arrive at the Service Catalog. Click IMPORT, lower right.

   ![](../.gitbook/assets/import%20%281%29.png)

3. Navigate to Admin &gt; Portfolios list &gt; Imported Portfolios. Click Quilt Enterprise.

   ![](../.gitbook/assets/portfolio%20%281%29.png)

4. On the Portfolio details page, click ADD USER, GROUP OR ROLE. Add any users, **including yourself**, whom you would like to be able to install Quilt.

   ![](../.gitbook/assets/portfolio-users%20%281%29.png)

5. Click Products list, upper left. Click the menu to the left of Quilt CloudFormation Template. Click Launch product. \(In the future, use the same menu to upgrade Quilt when a new version is released.\)

   ![](../.gitbook/assets/products-list%20%281%29.png)

6. Continue to the [CloudFormation](technical-reference.md#CloudFormation) section. Note: the following screenshots may differ slightly fromm what you see in Service Catalog.

### CloudFormation

1. Specify stack details in the form of a stack _name_ and CloudFormation _parameters_. Refer to the descriptions displayed above each text box for further details. Service Catalog users require a license key. See [Before you install Quilt](technical-reference.md#before-you-install-quilt) for how to obtain a license key.

   ![](../.gitbook/assets/stack-details%20%281%29.png)

   If you wish to use a service role, specify it as follows:

   ![](../.gitbook/assets/service-role%20%281%29.png)

2. Service Catalog users, skip this step. Under Stack creation options, enable termination protection.

   ![](../.gitbook/assets/term_protect%20%281%29.png)

   This protects the stack from accidental deletion. Click Next.

3. Service Catalog users, skip this step. Check the box asking you to acknowledge that CloudFormation may create IAM roles, then click Create.

   ![](../.gitbook/assets/finish%20%281%29.png)

4. CloudFormation takes about 30 minutes to create the resources for your stack. You may monitor progress under Events. Once the stack is complete, you will see `CREATE_COMPLETE` as the Status for your CloudFormation stack.

   ![](../.gitbook/assets/events%20%281%29.png)

5. To finish the installation, you will want to view the stack Outputs.

   ![](../.gitbook/assets/outputs%20%281%29.png)

   In a separate browser window, open the DNS settings for your domain. Create the following `CNAME` records. **Replace italics** with the corresponding stack Outputs.

   | CNAME | Value |
   | :--- | :--- |
   | _QuiltWebHost Key_ | _LoadBalancerDNSName_ |
   | _RegistryHostName Key_ | _LoadBalancerDNSName_ |
   | _S3ProxyHost Key_ | _LoadBalancerDNSName_ |

6. Quilt is now up and running. You can click on the _QuiltWebHost_ value in Outputs and log in with your administrator password to invite users.

## Advanced configuration

The default Quilt settings are adequate for most use cases. The following section covers advanced customization options.

### Single sign-on \(SSO\)

#### Google

You can enable users on your Google domain to sign in to Quilt. Refer to [Google's instructions on OAuth2 user agents](https://developers.google.com/identity/protocols/OAuth2UserAgent) and create authorization credentials to identify your Quilt stack to Google's OAuth 2.0 server.

![](../.gitbook/assets/google_console%20%281%29.png)

In the template menu \(CloudFormation or Service Catalog\), select Google under _User authentication to Quilt_. Enter the domain or domains of your Google apps account under _SingleSignOnDomains_. Enter the _Client ID_ of the OAuth 2.0 credentials you created into the field labeled _GoogleClientId_

![](../.gitbook/assets/google_auth%20%281%29.png)

#### Okta

1. Go to Okta &gt; Admin &gt; Applications
2. Click `Add Application`
3. Select type `Web` 
4. Name the app `Quilt` or something similar
5. Configure the app as shown below
6. Add `<QuiltWebHost>` to `Login redirect URIs` and

   `Initiate login URI`

7. Copy the `Client ID` to a safe place
8. Go to API &gt; Authorization servers
9. You should see a default URI that looks something like this

   `https://<MY_COMPANY>.okta.com/oauth2/default`; copy it to a

   safe place

10. Proceed to [Enabling SSO](technical-reference.md#Enabling-SSO-in-CloudFormation)

![](../.gitbook/assets/okta-sso-general.png)

#### OneLogin

1. Go to Administration : Applications &gt; Custom Connectors
2. Click `New Connector`
   1. Name the connector _Quilt Connector_ or something similar
   2. Set `Sign on method` to `OpenID Connect`
   3. Set `Login URL` to `https://<QuiltWebHost>/oauth-callback`
   4. Save
3. Go back to Applications &gt; Custom Connectors
4. Click `Add App to Connector`
5. Save the app \(be sure to save it for the Organization\)
6. Go to Applications &gt; Applications &gt; _Your new app_ &gt; SSO
   1. Click SSO. Copy the _Client ID_ and _Issuer URL V2_ to a safe place.
7. Add _Your new app_ to the users who need to access

   Quilt

8. Proceed to [Enabling SSO](technical-reference.md#Enabling-SSO-in-CloudFormation)

![](../.gitbook/assets/onelogin-connector.png) ![](../.gitbook/assets/onelogin-sso.png) ![](../.gitbook/assets/onelogin-users.png)

#### Enabling SSO in CloudFormation

Now you can connect Quilt to your SSO provider. In the Quilt template \(AWS Console &gt; CloudFormation &gt; _Quilt stack_ &gt; Update &gt; Use current template &gt; Next &gt; Specify stack details\), set the following parameters:

* _AuthType_: Enabled
* _AuthClientId_: _Client ID_
* _AuthBaseUrl_: _Issuer URL V2_

### Preparing an AWS Role for use with Quilt

These instructions document how to set up an existing role for use with Quilt. If the role you want to use doesn't exist yet, create it now.

Go to your Quilt stack in CloudFormation. Go to `Outputs`, then find `RegistryRoleARN` and copy its value. It should look something like this: `arn:aws:iam::000000000000:role/stackname-ecsTaskExecutionRole`.

Go to the IAM console and navigate to `Roles`. Select the role you want to use. Go to the `Trust Relationships` tab for the role, and select `Edit Trust Relationship`. The statement might look something like this:

```javascript
{
  "Version": "2012-10-17",
  "Statement": [
    "... one or more statements"
  ]
}
```

Add an object to the beginning of the Statement array with the following contents:

```javascript
{
  "Effect": "Allow",
  "Principal": {
    "AWS": "$YOUR_REGISTRY_ROLE_ARN"
  },
  "Action": "sts:AssumeRole"
},
```

Note the comma after the object. Your trust relationship should now look something like this:

```javascript
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

You can now configure a Quilt Role with this role \(using the Catalog's admin panel, or `quilt3.admin.create_role`\).

