# Overview

Running a private registry 

# Deploy a Quilt Teams Registry on AWS Marketplace

## Subscribe and Accept License Terms
To begin, subscribe to the [Quilt Teams Registry](https://aws.amazon.com/marketplace/pp/B07GDSGJ3S) on AWS Marketplace. Subscribing. You will be asked to accept the terms of the software license. After accepting, click "Continue to Configuration." Choose the AWS Region in which you'd like to run your Registry then click "Continue to Launch" and choose "Launch CloudFormation" under "Choose Action." Then click the Launch button to run the Quilt Teams Registry CloudFormation Template.

## Permissions and Pre-Launch Requirements
Deploying a Quilt Teams Registry from AWS Marketplace requires `AdminstratorAccess` or at least following abilities:
- Create a stack in CloudFormation
- Create a bucket in S3
- Create an IAM User
- Create an RDS instance

The Quilt Teams Registry also requires a valid SSL certificate for the domain in which you plan to host your Quilt registry and catalog. If you do not already have an SSL certificate in AWS, this page on [Getting Started with AWS Certificate Manager](https://docs.aws.amazon.com/acm/latest/userguide/gs.html) has instructions for how to import a certificate to AWS or request a new certificate.

The registry also uses SMTP to send emails to verfiy users during sign up and to enable password resets. The Registry template asks for credentials to your SMTP service. If you do not already have an SMTP service running, see the [Amazon SES Quick Start Guide](https://docs.aws.amazon.com/ses/latest/DeveloperGuide/quick-start.html) to set up email sending in your AWS account.

### AWS Resources Created
The CloudFormation template creates several services to run The Quilt Teams Registry including:
- EC2 Instance (`t2-small` or `m5-large` as set in `InstanceType` above)
- S3 bucket
- RDS Postgres Database (`t2-small` or `m5-large` as set in `DBInstanceType` above)
- Elastic Load balancer (ELB)
- VPC (with 3 subnets)
- Security Groups (for SSH and HTTPS via the ELB)
- IAM User (the registry runs as this new user) with permissions limited to accessing the newly created bucket:
    - s3:DeleteObject
    - s3:GetObject
    - s3:HeadObject
    - s3:PutObject
    - s3:ListBucket 

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

After entering all the template parameters, click `Next`. Acknowledge that the template will create IAM users. _Note: the template creates an IAM User instead of a role because an IAM User can create signed URLs that remain vaild for long durations, which can be necessary to upload very large files to S3._ Click `Create` to start the deployment. The deployment process takes approximately 45 minutes to complete.

## Configure Your Registry and Create an Admin Account
After the CloudFormation template brings up your registry stack, set up DNS entries in your domain for the catalog and registry. Login to your DNS provider and create a `CNAME` record with the name you chose for `CatalogHost` in the CloudFormation template that points to the DNS of the Elastic Load Balancer created by the template. Find the DNS name in the stack outputs under `LoadBalancerDNSName`. Create another `CNAME` record with the `RegistryHost` that also points to `LoadBalancerDNSName`. Once the DNS is configured, SSH into the EC2 instance created by the template (you can find the IP address of that instance in the template outputs under `EC2InstanceIp`. In the terminal, run the following commands to create an admin user:
```bash
. env/registry
./create_admin.sh
```
Enter a username and email for the first admin user and choose a password. After running `create_admin.sh` test your new account by logging into your Quilt Teams Registry by browsing to `CatalogHost` in your browser.

## Security
### S3
All package data files are stored in S3 in the bucket created by the template (`PackageBucket`). The bucket is configured as follows:
```yaml
 Bucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName:
        Ref: PackageBucket
      CorsConfiguration:
        CorsRules:
        - AllowedHeaders:
          - Authorization
          AllowedMethods:
          - GET
          AllowedOrigins:
          - '*'
          MaxAge: 3000
      VersioningConfiguration:
        Status: Enabled
```
As created by the template, the bucket is accessible only to the Registry user (also created by the template) and any IAM users with `AdinistratorAcess`. The bucket is accessible from any origin so that Quilt Registry users can download files directly from S3 using signed URLs returned by Quilt API calls. For security and consistency, it is recommended that all access to package data are made via API calls to the Quilt Registry and via signed URLs returned by the Quilt Registry.

### Networking and VPC
For security, the Registry EC2 instance and database run in a VPC. The VPC has two security groups: `SshSecurityGroup` for allowing SSH access to the Registry EC2 Instance and `ElbSecurityGroup` for allowing HTTPS connections to the Registry through the ELB. The VPC is connected to the Internet by a Internet Gateway. The Input CIDR for the SshSecurityGroup is a user-settable input to the template (`SshInputCIDR`).

### IAM
The CloudFormation template creates an IAM user `RegistryUser` and grants it access to `PackageBucket`. The Quilt Registry runs as `RegistryUser` and uses its S3 permissions to sign URLs granting upload and download access to Keys in `PackageBucket`.
```yaml
 RegistryUser:
    Type: AWS::IAM::User
    Properties:
      Path: /
      Policies:
      - PolicyName: quilt-registry-s3
        PolicyDocument:
          Statement:
          - Effect: Allow
            Action:
            - s3:DeleteObject
            - s3:GetObject
            - s3:HeadObject
            - s3:PutObject
            Resource:
              Fn::Sub: 'arn:aws:s3:::${Bucket}/*'
          - Effect: Allow
            Action:
            - s3:ListBucket
            Resource:
              Fn::Sub: 'arn:aws:s3:::${Bucket}'
```
The `AWS_ACCESS_KEY_ID` and `AWS_SECRET_KEY` for `RegistryUser` are written to the file `/home/ec2-user/env/registry` on the EC Instance as part of the deployment process. The Registry process reads its environment from the file and with it assumes the `RegistryUser` credentials.

To rotate the key for `RegistryUser` using the AWS console, browse to Servies->IAM->Users. Select the user created by the template `${TeamId}-RegistryUser-${UID}`. Click the button `Create access key`. Record the new credentials. SSH into the Registry EC2 instance and edit `/home/ec2-user/env/registry`. Update `AWS_ACCESS_KEY_ID` and `AWS_SECRET_KEY` to the values corresponding to the new key. Restart the Registry by running:
```bash
docker rm -f registry catalog registry-nginx
./start.sh
```

## Architecture
- Diagram?

## Backup and Recovery
The Quilt registry stores package state and metadata in an RDS Postgres Database. Follow these [instructions](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_CommonTasks.BackupRestore.html) to backup and restore the Registry database.

All package objects are stored in S3. For additional protection for object files, you can enable [object versioning](https://docs.aws.amazon.com/AmazonS3/latest/dev/ObjectVersioning.html) and [cross-region replication](https://docs.aws.amazon.com/AmazonS3/latest/dev/crr.html) on your `PackageBucket`.

# Build and Run the Open-Source Registry Code
Follow the instructions in the Registry [docs](../registry/README.md)
