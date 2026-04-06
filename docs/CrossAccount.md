<!-- markdownlint-disable -->
# Cross-Account Access: Secure Multi-Account Quilt Deployment

This guide explains how to set up Quilt across multiple AWS accounts, enabling you to separate your control plane (Quilt infrastructure) from your data plane (S3 buckets) for enhanced security, compliance, and organizational structure.

## 🎯 Architecture Overview

### Why Cross-Account Setup?

**Common Use Cases:**
- 🏢 **Organizational Separation**: Different teams/departments own different accounts
- 🔒 **Security Isolation**: Separate sensitive data from application infrastructure  
- 📊 **Compliance Requirements**: Regulatory requirements for data segregation
- 💰 **Cost Management**: Separate billing and resource management
- 🛡️ **Blast Radius Reduction**: Limit impact of security incidents

### Account Structure

In this guide, we'll configure two accounts:

```
┌─────────────────────────────────────┐
│           Control Account           │
│  ┌─────────────────────────────────┐│
│  │     Quilt Infrastructure        ││
│  │  • CloudFormation Stack        ││
│  │  • Lambda Functions            ││
│  │  • Elasticsearch/OpenSearch    ││
│  │  • API Gateway                 ││
│  │  • Web Application             ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
                   │
                   │ Cross-Account
                   │ Access
                   ▼
┌─────────────────────────────────────┐
│            Data Account             │
│  ┌─────────────────────────────────┐│
│  │        S3 Buckets              ││
│  │  • Raw Data Bucket            ││
│  │  • Processed Data Bucket      ││
│  │  • Archive Bucket             ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

**Account Definitions:**
- **Control Account**: Contains the Quilt CloudFormation stack and infrastructure
- **Data Account**: Contains the S3 buckets with your actual data

## 🚀 Step-by-Step Implementation Guide

### Prerequisites

Before starting, ensure you have:
- ✅ **Administrative access** to both AWS accounts
- ✅ **Quilt already deployed** in the Control Account
- ✅ **S3 buckets created** in the Data Account
- ✅ **AWS CLI configured** with appropriate profiles

### Step 1: Configure S3 Object Ownership

**Why This Matters:**
When Quilt (running in Control Account) writes objects to buckets in Data Account, you want the Data Account to own those objects for proper access control.

**Implementation:**

1. **Navigate to S3 Console** in Data Account
2. **Select your bucket** → **Permissions** → **Object Ownership**
3. **Edit Object Ownership** and select **"Bucket owner enforced"**

**Using AWS CLI:**
<!-- pytest-codeblocks:skip -->
```bash
# Set object ownership to bucket owner enforced
aws s3api put-bucket-ownership-controls \
    --bucket your-data-bucket \
    --ownership-controls Rules='[{ObjectOwnership=BucketOwnerEnforced}]' \
    --profile data-account
```

**Why "Bucket owner enforced"?**
- ✅ Data Account automatically owns all objects
- ✅ Simplifies access control management
- ✅ Prevents ACL-based access complications
- ✅ Required for cross-account Quilt operations

### Step 2: Register the Bucket with `quiltx`

**Purpose:**
Configure cross-account bucket policy, SNS notifications, and register the bucket
in the Quilt catalog — all from the Data Account, under your control.

[`quiltx`](https://pypi.org/project/quiltx/) is a command-line tool that automates
cross-account bucket setup. It **merges** policies and notifications with any
existing configuration rather than replacing them, so your existing S3 event
notifications, Lambda triggers, and bucket policies are preserved.

**Install quiltx:**

<!-- pytest-codeblocks:skip -->
```bash
# Using uvx (recommended, no install required)
uvx quiltx bucket add your-data-bucket --profile data-account --dry-run

# Or install with pip
pip install quiltx
```

**Preview changes with `--dry-run`:**

<!-- pytest-codeblocks:skip -->
```bash
# Review planned bucket policy, SNS topic, and notification changes
quiltx bucket add your-data-bucket --profile data-account --dry-run
```

This prints the exact bucket policy, SNS topic policy, and notification
configuration that will be applied — review them before proceeding.

**Apply changes:**

<!-- pytest-codeblocks:skip -->
```bash
# Configure bucket policy, SNS topic, notifications, and register in Quilt
quiltx bucket add your-data-bucket --profile data-account
```

`quiltx bucket add` performs the following steps:
1. **Merges** a cross-account bucket policy statement (by `Sid`) granting the Quilt
   control account read/write access
2. **Creates or reuses** an SNS topic in the Data Account for S3 event notifications
3. **Configures** the SNS topic policy to allow S3 to publish and Quilt to subscribe
4. **Merges** the SNS notification into the bucket's existing notification configuration
   (by `Id`), preserving any other notifications already in place
5. **Registers** the bucket in the Quilt catalog

**Verify the setup:**

<!-- pytest-codeblocks:skip -->
```bash
# Verify registration and cross-account read access
quiltx bucket test your-data-bucket
```

**🔒 Security Note:**
> Because `quiltx` runs with **your** AWS credentials in the Data Account, you
> retain full control over what policies and notifications are applied to your
> buckets. Quilt's control account never needs `s3:PutBucketNotification`
> permission. Quilt admins can still control user access through the Quilt Admin
> Panel's Roles and Policies.

### Step 3: Set Up CloudTrail (Required)

**Why CloudTrail is Required:**
- **Security & Auditing**: Track all S3 API calls
- **User Analytics**: Quilt uses CloudTrail data for user-facing analytics
- **Compliance**: Many regulatory frameworks require audit trails

**Implementation Options:**

#### Option A: Quilt-Managed CloudTrail (Recommended)

If Quilt manages CloudTrail in the Control Account:

1. **Check CloudFormation Stack** in Control Account
2. Go to **CloudFormation** → **Your Quilt Stack** → **Resources**
3. Look for a **CloudTrail resource** (Quilt will auto-add your buckets)

#### Option B: Existing CloudTrail

If you have existing CloudTrail in either account:

1. **Identify the Trail:**
   <!-- pytest-codeblocks:skip -->
   ```bash
   # List trails in Data Account
   aws cloudtrail describe-trails --profile data-account
   
   # List trails in Control Account  
   aws cloudtrail describe-trails --profile control-account
   ```

2. **Add S3 Data Events:**
   <!-- pytest-codeblocks:skip -->
   ```bash
   # Add data events for your bucket
   aws cloudtrail put-event-selectors \
       --trail-name your-trail-name \
       --event-selectors '[
           {
               "ReadWriteType": "All",
               "IncludeManagementEvents": true,
               "DataResources": [
                   {
                       "Type": "AWS::S3::Object",
                       "Values": ["arn:aws:s3:::your-data-bucket/*"]
                   },
                   {
                       "Type": "AWS::S3::Bucket", 
                       "Values": ["arn:aws:s3:::your-data-bucket"]
                   }
               ]
           }
       ]' \
       --profile data-account
   ```

3. **Update Quilt Configuration:**
   - Go to **CloudFormation** → **Your Quilt Stack** → **Parameters**
   - Update the **CloudTrail bucket parameter** with your existing trail's S3 bucket

#### Option C: Cross-Account CloudTrail Access

If CloudTrail is in Data Account but Quilt needs access:

**CloudTrail Bucket Policy:**
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "QuiltCloudTrailAccess",
            "Effect": "Allow",
            "Principal": {
                "AWS": "arn:aws:iam::CONTROL-ACCOUNT-ID:root"
            },
            "Action": [
                "s3:GetObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::your-cloudtrail-bucket",
                "arn:aws:s3:::your-cloudtrail-bucket/*"
            ]
        }
    ]
}
```

### Step 4: Verify Registration

If you used `quiltx bucket add` in Step 2, the bucket is already registered in
Quilt. Verify with:

<!-- pytest-codeblocks:skip -->
```bash
# List all registered buckets
quiltx bucket list

# Test cross-account access
quiltx bucket test your-data-bucket
```

Then upload a test file and check the Quilt catalog to confirm indexing works.

## 🔧 Testing Your Cross-Account Setup

### Verification Steps

#### 1. Test Basic Access
<!-- pytest-codeblocks:skip -->
```bash
# From Control Account, test bucket access
aws s3 ls s3://your-data-bucket --profile control-account

# Upload a test file
echo "Cross-account test" > test.txt
aws s3 cp test.txt s3://your-data-bucket/ --profile control-account
```

#### 2. Verify Quilt Integration
1. **Upload a file** to your cross-account bucket
2. **Wait 2-3 minutes** for processing
3. **Check Quilt catalog** to see if the file appears
4. **Test search functionality** in Quilt

#### 3. Check CloudTrail Logging
<!-- pytest-codeblocks:skip -->
```bash
# Verify CloudTrail is capturing events
aws logs filter-log-events \
    --log-group-name CloudTrail/YourLogGroup \
    --filter-pattern "{ $.eventSource = s3.amazonaws.com }" \
    --profile data-account
```

### Troubleshooting Common Issues

#### Issue 1: Access Denied Errors

**Symptoms:**
- Quilt can't access the bucket
- "Access Denied" in Quilt logs

**Solutions:**
1. **Verify bucket policy** is correctly applied
2. **Check object ownership** is set to "Bucket owner enforced"
3. **Confirm account IDs** in policies are correct
4. **Test with AWS CLI** from Control Account

#### Issue 2: Objects Not Appearing in Quilt

**Symptoms:**
- Files upload successfully but don't appear in Quilt catalog

**Solutions:**
1. **Check CloudTrail** is logging S3 data events
2. **Verify SNS configuration** if using custom topics
3. **Review Quilt logs** for processing errors
4. **Manual re-index** the bucket in Quilt Admin Panel

#### Issue 3: Permission Errors in Quilt Admin

**Symptoms:**
- Can't add bucket in Quilt Admin Panel
- IAM permission errors

**Solutions:**
1. **Check Quilt IAM roles** have cross-account assume permissions
2. **Verify bucket policy** allows required actions
3. **Review CloudFormation** stack permissions

## 🔐 Security Best Practices

### Principle of Least Privilege

**Bucket policy and notifications managed by you:**
`quiltx bucket add` runs with your own AWS credentials in the Data Account.
The Quilt control account never needs `s3:PutBucketNotification` permission —
you configure notifications yourself, and `quiltx` merges them safely with any
existing notification configuration.

If your stack exposes a `RegistryRoleARN` output, `quiltx` automatically scopes
the bucket policy principal to that specific role instead of the account root.

### Network Security

**VPC Considerations:**
- ✅ **VPC Endpoints**: Use S3 VPC endpoints to keep traffic within AWS network
- ✅ **Security Groups**: Restrict Lambda function network access
- ✅ **NACLs**: Additional network-level controls if required

**Example VPC Endpoint Policy:**
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": "*",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::your-data-bucket",
                "arn:aws:s3:::your-data-bucket/*"
            ],
            "Condition": {
                "StringEquals": {
                    "aws:PrincipalAccount": ["CONTROL-ACCOUNT-ID"]
                }
            }
        }
    ]
}
```

### Monitoring and Auditing

**CloudWatch Alarms:**
Set up monitoring for cross-account access:

<!-- pytest-codeblocks:skip -->
```bash
# Create alarm for failed S3 access attempts
aws cloudwatch put-metric-alarm \
    --alarm-name "CrossAccountS3AccessFailures" \
    --alarm-description "Monitor failed cross-account S3 access" \
    --metric-name ErrorCount \
    --namespace AWS/S3 \
    --statistic Sum \
    --period 300 \
    --threshold 5 \
    --comparison-operator GreaterThanThreshold \
    --profile control-account
```

**CloudTrail Monitoring:**
Monitor specific cross-account activities:

```json
{
    "eventVersion": "1.05",
    "userIdentity": {
        "type": "AssumedRole",
        "principalId": "AIDACKCEVSQ6C2EXAMPLE",
        "arn": "arn:aws:sts::CONTROL-ACCOUNT-ID:assumed-role/QuiltRole/QuiltLambda",
        "accountId": "CONTROL-ACCOUNT-ID"
    },
    "eventTime": "2024-08-26T10:30:00Z",
    "eventSource": "s3.amazonaws.com",
    "eventName": "GetObject",
    "resources": [
        {
            "ARN": "arn:aws:s3:::your-data-bucket/file.csv",
            "accountId": "DATA-ACCOUNT-ID"
        }
    ]
}
```

### Compliance Considerations

**Data Residency:**
- 🌍 **Regional Compliance**: Ensure both accounts are in compliant regions
- 📋 **Data Classification**: Tag buckets with appropriate data classification
- 🔒 **Encryption**: Enable S3 encryption with appropriate KMS keys

**Audit Requirements:**
- 📊 **Access Logging**: Enable S3 access logging for detailed audit trails
- 🔍 **Regular Reviews**: Periodically review cross-account permissions
- 📝 **Documentation**: Maintain documentation of cross-account relationships

## 🚀 Advanced Configurations

### Multi-Region Setup

For multi-region deployments, run `quiltx bucket add` for each bucket:

<!-- pytest-codeblocks:skip -->
```bash
for bucket in your-data-bucket-us-east-1 your-data-bucket-us-west-2 your-data-bucket-eu-west-1; do
    quiltx bucket add "$bucket" --profile data-account
done
```

## 📚 Additional Resources

### AWS Documentation
- **[Cross-Account Access](https://docs.aws.amazon.com/IAM/latest/UserGuide/tutorial_cross-account-with-roles.html)** - AWS IAM cross-account access patterns
- **[S3 Bucket Policies](https://docs.aws.amazon.com/AmazonS3/latest/userguide/bucket-policies.html)** - Comprehensive S3 policy guide
- **[CloudTrail Cross-Account](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-sharing-logs.html)** - CloudTrail log sharing

### Quilt-Specific Resources
- **[quiltx](https://pypi.org/project/quiltx/)** - CLI tool for cross-account bucket setup
- **[Quilt Admin API](api-reference/Admin.md)** - Programmatic bucket management
- **[EventBridge Integration](EventBridge.md)** - Alternative event routing
- **[Security Best Practices](advanced-features/good-practice.md)** - General Quilt security guidance

### Tools and Scripts
- **[AWS CLI Reference](https://docs.aws.amazon.com/cli/latest/reference/s3api/)** - S3 API commands
- **[IAM Policy Simulator](https://policysim.aws.amazon.com/)** - Test policies before applying

## 📞 Support

**Need Help with Cross-Account Setup?**
- 📧 **Email**: [support@quilt.bio](mailto:support@quilt.bio)
- 💬 **Slack**: [Quilt Community](https://slack.quilt.bio)
- 📖 **Documentation**: [Quilt Docs](https://docs.quilt.bio/)
- 🐛 **Issues**: [GitHub Issues](https://github.com/quiltdata/quilt/issues)

---

**Success!** You now have a secure, compliant cross-account Quilt deployment that separates your control plane from your data plane while maintaining full functionality.
