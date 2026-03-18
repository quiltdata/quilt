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

### Step 2: Create Cross-Account Bucket Policy

**Purpose:**
Grant Quilt infrastructure in Control Account the necessary permissions to manage buckets in Data Account.

**Create the Bucket Policy:**

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "QuiltCrossAccountAccess",
            "Effect": "Allow",
            "Principal": {
                "AWS": "arn:aws:iam::CONTROL-ACCOUNT-ID:root"
            },
            "Action": [
                "s3:GetObject",
                "s3:GetObjectAttributes", 
                "s3:GetObjectTagging",
                "s3:GetObjectVersion",
                "s3:GetObjectVersionAttributes",
                "s3:GetObjectVersionTagging",
                "s3:ListBucket",
                "s3:ListBucketVersions",
                "s3:DeleteObject",
                "s3:DeleteObjectVersion",
                "s3:PutObject",
                "s3:PutObjectTagging",
                "s3:GetBucketNotification",
                "s3:PutBucketNotification"
            ],
            "Resource": [
                "arn:aws:s3:::your-data-bucket",
                "arn:aws:s3:::your-data-bucket/*"
            ]
        }
    ]
}
```

**Apply the Policy:**

**Console Method:**
1. Go to **S3 Console** → **Your Bucket** → **Permissions** → **Bucket Policy**
2. Paste the JSON above (replace `CONTROL-ACCOUNT-ID` and `your-data-bucket`)
3. Click **Save changes**

**CLI Method:**
<!-- pytest-codeblocks:skip -->
```bash
# Save policy to file
cat > bucket-policy.json << 'EOF'
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "QuiltCrossAccountAccess",
            "Effect": "Allow",
            "Principal": {
                "AWS": "arn:aws:iam::123456789012:root"
            },
            "Action": [
                "s3:GetObject",
                "s3:GetObjectAttributes",
                "s3:GetObjectTagging",
                "s3:GetObjectVersion", 
                "s3:GetObjectVersionAttributes",
                "s3:GetObjectVersionTagging",
                "s3:ListBucket",
                "s3:ListBucketVersions",
                "s3:DeleteObject",
                "s3:DeleteObjectVersion",
                "s3:PutObject",
                "s3:PutObjectTagging",
                "s3:GetBucketNotification",
                "s3:PutBucketNotification"
            ],
            "Resource": [
                "arn:aws:s3:::your-data-bucket",
                "arn:aws:s3:::your-data-bucket/*"
            ]
        }
    ]
}
EOF

# Apply the policy
aws s3api put-bucket-policy \
    --bucket your-data-bucket \
    --policy file://bucket-policy.json \
    --profile data-account
```

**🔒 Security Note:**
> Quilt admins can still control user access to this bucket through the Quilt Admin Panel's Roles and Policies. The bucket policy only grants access to Quilt infrastructure, not end users.

### Step 3: Configure Cross-Account SNS (Optional)

**When You Need This:**
If you're using [EventBridge integration](EventBridge.md) or have existing SNS topics in the Data Account that Quilt should use for notifications.

**Create SNS Topic Policy:**

Add this statement to your SNS topic's resource policy in the Data Account:

```json
{
    "Sid": "QuiltCrossAccountSNSAccess",
    "Effect": "Allow",
    "Principal": {
        "AWS": "arn:aws:iam::CONTROL-ACCOUNT-ID:root"
    },
    "Action": [
        "sns:GetTopicAttributes",
        "sns:Subscribe",
        "sns:Unsubscribe"
    ],
    "Resource": "arn:aws:sns:region:DATA-ACCOUNT-ID:your-topic-name"
}
```

**Apply SNS Policy:**

<!-- pytest-codeblocks:skip -->
```bash
# Get current policy
aws sns get-topic-attributes \
    --topic-arn arn:aws:sns:region:DATA-ACCOUNT-ID:your-topic-name \
    --attribute-names Policy \
    --profile data-account

# Update policy (merge with existing statements)
aws sns set-topic-attributes \
    --topic-arn arn:aws:sns:region:DATA-ACCOUNT-ID:your-topic-name \
    --attribute-name Policy \
    --attribute-value file://sns-policy.json \
    --profile data-account
```

**Configure in Quilt:**
1. Open **Quilt Admin Panel** → **Buckets**
2. Add or edit your cross-account bucket
3. Under **"Indexing and notifications"**, set the SNS Topic ARN
4. Save the configuration

### Step 4: Set Up CloudTrail (Required)

**Why CloudTrail is Required:**
- 🔍 **Security & Auditing**: Track all S3 API calls
- 📊 **User Analytics**: Quilt uses CloudTrail data for user-facing analytics
- 🚨 **Compliance**: Many regulatory frameworks require audit trails

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

### Step 5: Add Bucket to Quilt

**Final Configuration:**

1. **Open Quilt Admin Panel** in Control Account
2. Navigate to **Buckets** → **Add Bucket**
3. **Configure the bucket:**
   - **Bucket Name**: `your-data-bucket`
   - **Region**: Same as the bucket
   - **SNS Topic ARN**: (If using cross-account SNS)
   - **Event Notifications**: Leave disabled if using EventBridge

4. **Save and Test:**
   - Click **Save**
   - Upload a test file to verify indexing works
   - Check Quilt catalog for the new file

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

**Bucket Policy Refinements:**
Instead of granting access to the entire Control Account root, consider restricting to specific Quilt roles:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "QuiltSpecificRoleAccess",
            "Effect": "Allow",
            "Principal": {
                "AWS": [
                    "arn:aws:iam::CONTROL-ACCOUNT-ID:role/QuiltLambdaRole",
                    "arn:aws:iam::CONTROL-ACCOUNT-ID:role/QuiltIndexerRole"
                ]
            },
            "Action": [
                "s3:GetObject",
                "s3:ListBucket",
                "s3:PutObject"
            ],
            "Resource": [
                "arn:aws:s3:::your-data-bucket",
                "arn:aws:s3:::your-data-bucket/*"
            ]
        }
    ]
}
```

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

For multi-region deployments:

<!-- pytest-codeblocks:skip -->
```bash
# Replicate bucket policy across regions
for region in us-east-1 us-west-2 eu-west-1; do
    aws s3api put-bucket-policy \
        --bucket "your-data-bucket-${region}" \
        --policy file://bucket-policy.json \
        --region $region \
        --profile data-account
done
```

### Automated Policy Management

**CloudFormation Template for Bucket Policies:**

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Description: 'Cross-account bucket policies for Quilt'

Parameters:
  ControlAccountId:
    Type: String
    Description: 'Control account ID where Quilt is deployed'
  
  DataBucketName:
    Type: String
    Description: 'Name of the data bucket'

Resources:
  CrossAccountBucketPolicy:
    Type: AWS::S3::BucketPolicy
    Properties:
      Bucket: !Ref DataBucketName
      PolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Sid: QuiltCrossAccountAccess
            Effect: Allow
            Principal:
              AWS: !Sub 'arn:aws:iam::${ControlAccountId}:root'
            Action:
              - 's3:GetObject'
              - 's3:GetObjectAttributes'
              - 's3:ListBucket'
              - 's3:PutObject'
              - 's3:DeleteObject'
            Resource:
              - !Sub 'arn:aws:s3:::${DataBucketName}'
              - !Sub 'arn:aws:s3:::${DataBucketName}/*'
```

## 📚 Additional Resources

### AWS Documentation
- **[Cross-Account Access](https://docs.aws.amazon.com/IAM/latest/UserGuide/tutorial_cross-account-with-roles.html)** - AWS IAM cross-account access patterns
- **[S3 Bucket Policies](https://docs.aws.amazon.com/AmazonS3/latest/userguide/bucket-policies.html)** - Comprehensive S3 policy guide
- **[CloudTrail Cross-Account](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-sharing-logs.html)** - CloudTrail log sharing

### Quilt-Specific Resources
- **[Quilt Admin API](api-reference/Admin.md)** - Programmatic bucket management
- **[EventBridge Integration](EventBridge.md)** - Alternative event routing
- **[Security Best Practices](advanced-features/good-practice.md)** - General Quilt security guidance

### Tools and Scripts
- **[AWS CLI Reference](https://docs.aws.amazon.com/cli/latest/reference/s3api/)** - S3 API commands
- **[Policy Generator](https://awspolicygen.s3.amazonaws.com/policygen.html)** - AWS Policy Generator tool
- **[IAM Policy Simulator](https://policysim.aws.amazon.com/)** - Test policies before applying

## 📞 Support

**Need Help with Cross-Account Setup?**
- 📧 **Email**: [support@quilt.bio](mailto:support@quilt.bio)
- 💬 **Slack**: [Quilt Community](https://join.slack.com/t/quiltusers/shared_invite/zt-2k7jszthh-rtAWEIDKgaYva4y9x8isSw)
- 📖 **Documentation**: [Quilt Docs](https://docs.quilt.bio/)
- 🐛 **Issues**: [GitHub Issues](https://github.com/quiltdata/quilt/issues)

---

**Success!** You now have a secure, compliant cross-account Quilt deployment that separates your control plane from your data plane while maintaining full functionality.
