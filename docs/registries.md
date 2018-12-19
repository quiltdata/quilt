# Deploy a Quilt Teams Registry on AWS Marketplace

## Subscribe and Accept License Terms
To begin, subscribe to the [Quilt Teams Registry](https://aws.amazon.com/marketplace/pp/B07GDSGJ3S) on AWS Marketplace. Subscribing. You will be asked to accept the terms of the software license. After accepting, click "Continue to Configuration." Choose the AWS Region in which you'd like to run your Registry then click "Continue to Launch" and choose "Launch CloudFormation" under "Choose Action." Then click the Launch button to run the Quilt Teams Registry CloudFormation Template.

## Pre-Launch Requirements
The Quilt Teams Registry requires a valid SSL certificate for the domain in which you plan to host your Quilt registry and catalog. If you do not already have an SSL certificate in AWS, this page on [Getting Started with AWS Certificate Manager](https://docs.aws.amazon.com/acm/latest/userguide/gs.html) has instructions for how to import a certificate to AWS or request a new certificate.

The registry also uses SMTP to send emails to verfiy users during sign up and to enable password resets. The Registry template asks for credentials to your SMTP service. If you do not already have an SMTP service running, see the [Amazon SES Quick Start Guide](https://docs.aws.amazon.com/ses/latest/DeveloperGuide/quick-start.html) to set up email sending in your AWS account.

## Deploy the Registry using CloudFormation
Select the default CloudFormation template URL, which is used to create and launch the registry stack. Fill in the following parameters in the template:
- Stack Name: the name under which you'll find the stack in CloudFormation
- Catalog Host: those hostname used to access the Quilt catalog (e.g., quilt.example.com).
- Certificate ARN: the ARN of your SSL certificate. The SSL certificate must be valid for the domain name you choose for Catalog Host and must be in the same AWS region as the registry stack.
- DBInstanceType: we recommend choosing t2.small for registries serving less than 1000 users and m5.large for very active registries.
- DBPassword: Choose a password for the Quilt Registry database.
- InstanceType: Instance type of the EC2 instance to run the registry service. We recommend choosing t2.small for registries serving less than 1000 users and m5.large for very active registries.
- KeyName: Choose a key pair to enable connecting to the registry instance via SSH.
- PackageBucket: Name of the S3 bucket to be created and used by the registry to store package data (must be a valid name for a new S3 bucket).
- RegistryHost: The hostname of the registry. `RegistryHost` must be in a domain covered by the SSL certific specified above (e.g., quilt-registry.example.com).
- SmtpDefaultSender: the default sending email account for registry emails
- SmtpPassword: Password for your email sending service
- SmtpUsername: Username for your email sending service
- SshInputCIDR: IP range (CIDR notation) for SSH access to the registry EC2 instance
- TeamId: Short alias for your team. We recommend one word, all lowercase.
- TeamName: Descriptive name for the team to be displayed on the catalog front page.

## Configure Your Registry and Create an Admin Account
After the CloudFormation template brings up your registry stack, set up DNS entries in your domain for the catalog and registry. Login to your DNS provider and create a `CNAME` record with the name you chose for `CatalogHost` in the CloudFormation template that points to the DNS of the Elastic Load Balancer created by the template. Find the DNS name in the stack outputs under `LoadBalancerDNSName`. Create another `CNAME` record with the `RegistryHost` that also points to `LoadBalancerDNSName`. Once the DNS is configured, SSH into the EC2 instance created by the template (you can find the IP address of that instance in the template outputs under `EC2InstanceIp`. In the terminal, run the following commands to create an admin user:
```bash
. env/registry
./create_admin.sh
```
Enter a username and email for the first admin user and choose a password. After running `create_admin.sh` test your new account by logging into your Quilt Teams Registry by browsing to `CatalogHost` in your browser.

## Backup and Recovery

The Quilt registry stores package state and metadata in an RDS Postgres Database. Follow these [instructions](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_CommonTasks.BackupRestore.html) to backup and restore the Registry database.

All package objects are stored in S3. For additional protection for object files, you can enable [object versioning](https://docs.aws.amazon.com/AmazonS3/latest/dev/ObjectVersioning.html) and [cross-region replication](https://docs.aws.amazon.com/AmazonS3/latest/dev/crr.html) on your `PackageBucket`.

# Build and Run the Open-Source Registry Code
Follow the instructions in the Registry [docs](../registry/README.md)
