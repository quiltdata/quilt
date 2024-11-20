<!-- markdownlint-disable-next-line first-line-h1 -->
If you ever need to delete a Quilt stack from your AWS account, be aware that:

- Your data in S3 buckets remains accessible.
- You can continue using the Quilt SDK for reading and writing packages.
- Stack-managed resources (Athena tables, user database, audit logs) will be affected.
- The deletion behavior varies between CloudFormation and Terraform deployments.

> **Consider Pausing Instead:** To temporarily suspend the stack, you can shut
> down ECS services to reduce costs. Note that some charges may continue even
> when ECS is inactive. The only way to completely eliminate all costs is to
> delete the stack.

---

## I. Impact Assessment and Preparation

### What May Be Deleted

- Custom configurations specific to the Quilt stack (e.g., IAM roles, resource
  mappings, permissions).
- Analytics data in stack-managed buckets.
- Audit logs and Athena querying setups.
- User database configurations.

### Required Actions

- Export analytics data you need to keep.
- Save important audit logs.
- Document existing Athena configurations if you'll need to recreate them.
- If using Terraform, use it to capture a snapshot of the user database.

---

## II. Stack Deletion Process

### Using CloudFormation

1. **Start the Deletion Process**  
   - Navigate to the **CloudFormation** console in your AWS region.  
   - Select your stack under **CloudFormation > Stacks**.  
   - Click **Delete Stack** to begin the process.

2. **Understand Deletion Behavior**  
   - CloudFormation attempts to delete all stack-managed resources.  
   - If a resource cannot be deleted (e.g., non-empty S3 bucket):  
     - Other independent resources will still be deleted.  
     - The stack enters the **DELETE_FAILED** state.  
     - Failed resources remain intact, including non-empty S3 buckets.  
     - To resolve:  
       - Back up any important files.  
       - Remove all files from the bucket via the S3 console or CLI.  
       - Retry the deletion process.

   - Alternatively, you can mark non-empty buckets for retention during deletion
     to preserve data, though this may require manual cleanup later.

### Using Terraform

1. **Start the Deletion Process**  
   - Open a terminal in your Terraform configuration directory.  
   - Run `terraform destroy`.

2. **Understand Deletion Behavior**  
   - Terraform stops at the first resource it cannot delete (e.g., non-empty S3
     buckets).  
   - Dependencies of the failed resource are preserved.  
   - To resolve:  
       - Back up important files and clear the bucket contents.  
       - Alternatively, configure Terraform to retain the resource by marking it
         for retention in the configuration.  
   - Once addressed, resume deletion by re-running `terraform destroy`.

---

## III. Final Steps

- Retry deletion after addressing any failed resources.  
- Verify deletion of all non-retained resources.  
- Confirm that the stack is no longer listed in CloudFormation or Terraform.  
- Check for any orphaned resources or residual costs using the **AWS Cost
  Explorer**.  

---

## IV. After Stack Deletion

- Your S3 bucket data remains intact and accessible.  
- The Quilt SDK continues to function for package operations.  
- Recreate any necessary Athena/Glue configurations if needed.
- Rebuild the user database if using Terraform.
