<!-- markdownlint-disable-next-line first-line-h1 -->
If you ever need to delete a Quilt stack from your AWS account, you should know
that:

- Your data in S3 buckets remains accessible.
- You can continue using the Quilt SDK for reading and writing packages.
- Stack-managed resources (Athena tables, Postgres database, audit logs) will be
  affected.
- The deletion behavior varies between CloudFormation and Terraform deployments.

---

## I. Impact Assessment and Preparation

### What May Be Deleted

- Custom configurations specific to the Quilt stack (e.g., IAM roles, resource
  mappings, permissions).
- Analytics data in stack-managed buckets.
- Audit logs and Athena querying setups.
- User account and tabulator configurations.

### Recommended Actions

- Export analytics data you need to keep.
- Save important audit logs.
- Document existing Athena configurations if you'll need to recreate them.
- Export the Postgres database (containing, e.g., user accounts and tabulator
  configuration) in case you want to reuse it for future stacks.

---

## II. Stack Deletion Process

### Using CloudFormation

1. **Start the Deletion Process**  
   - Navigate to the **CloudFormation** console in your AWS region.  
   - Select your stack under **CloudFormation > Stacks**.  
   - Click **Delete Stack** to begin the process.

2. **Empty or Ignore Non-Deleted Resources**
   - CloudFormation attempts to delete all stack-managed resources.  
   - If a resource cannot be deleted (e.g., non-empty S3 bucket):  
     - It will show a **DELETE_FAILED** status in the **Events** tab.
     - Failed resources remain intact, including non-empty S3 buckets.  
     - Other independent resources will still be deleted.  
     - The stack enters the **DELETE_FAILED** state.  
   - If you wish to remove those resources:
       - Back up any important files.  
       - Remove all files from the bucket via the S3 console or CLI.  
       - Retry the deletion process.
   - Alternatively, you can leave them undeleted, though that may require manual
     cleanup later.

### Using Terraform

1. **Start the Deletion Process**  
   - Open a terminal in your Terraform configuration directory.  
   - Run `terraform destroy`.

2. **Empty or Retain Non-Deleted Resources**  
   - Terraform stops at the first resource it cannot delete (e.g., non-empty S3
     buckets created by CloudFormation).  
   - Dependencies of the failed resource are preserved.  
   - To resolve, back up important files and clear the bucket contents.  

   - Once addressed, resume deletion by re-running `terraform destroy`.

---

## III. Final Steps

- Verify deletion of all non-retained resources.  
- Confirm that the stack is no longer listed in CloudFormation or Terraform.  
- Check for any orphaned resources or residual costs using the **AWS Cost
  Explorer**.  

---

## IV. After Stack Deletion

- Your S3 bucket data remains intact and accessible.  
- The Quilt SDK continues to function for package operations.  
- Recreate any necessary Athena/Glue configurations if needed.
