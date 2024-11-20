<!-- markdownlint-disable-next-line first-line-h1 -->
From time to time, you may need to remove a Quilt stack from your AWS account.
To do this, you will need to delete the CloudFormation stack that created the
stack, which will remove all resources associated with the stack.

### NOTE: Pausing the Stack Instead of Deletion

If you prefer to suspend the Quilt stack temporarily, consider pausing services
(e.g., shutting down ECS) to reduce costs. Note, however, that some charges may
continue even with ECS inactive. To fully stop charges, you must delete the
CloudFormation stack.

## Step 1: Confirm Stack Deletion Readiness

Deleting the CloudFormation stack will permanently remove any stack-specific
configurations, analytics data, audit logs, and Athena querying setups. Data in
your own S3 buckets will remain intact, as they are outside of CloudFormation’s
control.

### Important Considerations

1. **Backup of Analytics and Audit Logs**: If you need to retain any analytics
   or audit logs stored in stack-managed buckets, back up these files. Note that
   **you must delete these contents after backup** to allow CloudFormation to
   delete the buckets.
2. **Athena Configurations**: Athena databases and Glue resources associated
   with stack analytics data will be removed. To restore querying capabilities
   later, you may need to reconfigure these settings.

## Step 2: Attempt Stack Deletion in CloudFormation

1. In the **CloudFormation** console for the appropriate AWS region, locate your
   Quilt stack: CloudFormation > Stacks -> Your Stack Name.
2. Select **Delete** to begin the stack deletion process. AWS will attempt to
   delete all resources managed by the stack.

### Non-Empty S3 Buckets

### Nonempty S3 Buckets
stack contain data, the initial deletion attempt will fail. You have two
options:

1. **Manually Empty Buckets After Backup**:
   - Go to the **S3 console**, locate the non-empty buckets, and back up any
     important files to ensure they are preserved.
   - After backing up, delete all files within these buckets to enable
     CloudFormation to delete them on the next attempt.

2. **Retain Buckets**:
   - During deletion, AWS will list any resources that failed to delete.
   - Select the **retain** option for non-empty buckets to keep the data intact,
     leaving the bucket in your AWS account without deletion.

## Step 3: Finalize Deletion and Resource Management

Once buckets are emptied or retained, retry the stack deletion in
CloudFormation. All resources aside from those marked for retention will be
permanently removed.

By following these steps and carefully managing data retention, you can delete
your Quilt stack while ensuring important information is preserved.
