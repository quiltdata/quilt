<!-- markdownlint-disable-next-line first-line-h1 -->
If you ever need to delete a Quilt stack from your AWS account, be aware that:

- Your data in S3 buckets remains accessible
- You can continue to use the Quilt SDK continues to read and write packages
- Stack-managed resources (Athena tables, user database, audit logs) will be affected
- The deletion behavior varies between CloudFormation and Terraform deployments

> **Consider Pausing Instead:** To temporarily suspend the stack, you can shut
> down ECS services to reduce costs. Note that some charges may continue even
> when ECS is inactive. The only way to completely eliminate all costs is to
> delete the stack.

## I. Impact Assessment and Preparation

### What May Be Deleted

- Stack-specific configurations
- Analytics data in stack-managed buckets
- Audit logs and Athena querying setups
- User database configurations

### Required Actions

- Export analytics data you need to keep
- Save important audit logs
- Document existing Athena configurations if you'll need to recreate them
- If using Terraform, you can use it to capture a snapshot of the user database

## II. Stack Deletion Process

### Using CloudFormation

1. **Initiate Deletion**
   - Navigate to CloudFormation console in your AWS region
   - Select your stack under CloudFormation > Stacks
   - Click Delete to begin the process

2. **Deletion Behavior**
   - CloudFormation attempts to delete all stack-managed resources
   - If a resource cannot be deleted (e.g., non-empty S3 bucket):
     - Other independent resources will still be deleted
     - Stack enters DELETE_FAILED state
     - Failed resources remain intact
     - Successfully deleted resources stay removed

### Using Terraform

1. **Initiate Deletion**
   - Open terminal in your Terraform configuration directory
   - Run `terraform destroy`

2. **Deletion Behavior**
   - Terraform stops at the first resource it cannot delete
   - Dependencies of the failed resource are preserved
   - Successfully deleted resources remain removed
   - Process can be resumed after addressing the failure

## III. Handling Non-Empty Resources

### Option 1: Empty and Delete

1. Back up important files via S3 console
2. Remove all files from the buckets
3. Retry stack deletion

### Option 2: Retain Resources

1. Mark non-empty buckets for retention during deletion
2. Complete stack deletion while preserving marked buckets

## IV. Final Steps

- Retry deletion after handling any failed resources
- Verify deletion of all non-retained resources
- Confirm that the stack is no longer listed in CloudFormation or Terraform

## V. After Stack Deletion

- Your S3 bucket data remains intact and accessible
- Quilt SDK continues to function for package operations
- Recreate any necessary Athena/Glue configurations if needed
