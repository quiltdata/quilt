#!/usr/bin/env zsh

#
# Clear created entities so we can re-test scripts
#

# 1. Delete Quilt Role AthenaAccessRole
# 2. Delete Quilt Policy AthenaQuiltAccess
# 3. Detach Policy from quilt-t4-staging-ManagedUserRole-4J11ONMBPVM1
# 4. Delete AWS Policy

POLICY_ARN=arn:aws:iam::712023778557:policy/AthenaQuiltAccess
ROLE_NAME=quilt-t4-staging-ManagedUserRole-4J11ONMBPVM1
ROLE_ARN=arn:aws:iam::712023778557:role/$ROLE_NAME
USER=ernest

aws iam list-attached-role-policies --role-name $ROLE_NAME
aws iam list-attached-role-policies --role-name ReadWriteQuiltV2-quilt-t4-staging

aws iam list-attached-user-policies --user-name $USER

aws iam list-entities-for-policy --policy-arn $POLICY_ARN
# quilt-t4-staging-ManagedUserRole-4J11ONMBPVM1
aws iam detach-role-policy --policy-arn $POLICY_ARN --role-name $ROLE_NAME

aws iam delete-policy --policy-arn $POLICY_ARN

# An error occurred (DeleteConflict) when calling the DeletePolicy operation: Cannot delete a policy attached to entities.

# PROPOSAL
# Find Quilt Role ReadWriteQuiltV2
# Find the relevant Policies
# Add to a new Role + Athena Policy
# Create that Custom Role in Quilt
# Assign to a Quilt User