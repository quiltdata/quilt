 export TEST_BUCKET=s3://test-kms-policies
 aws s3 ls $TEST_BUCKET
 aws s3 cp TEST.md $TEST_BUCKET/
 aws s3 ls --recursive $TEST_BUCKET
 aws s3 cp TEST.md $TEST_BUCKET/with-kms/TEST.md
# upload failed: ./TEST.md to s3://test-kms-policies/with-kms/TEST.md An error occurred (AccessDenied) when calling the PutObject operation: User: arn:aws:iam::712023778557:user/ernest-staging is not authorized to perform: s3:PutObject on resource: "arn:aws:s3:::test-kms-policies/with-kms/TEST.md" with an explicit deny in a resource-based policy
aws s3 cp TEST.md $TEST_BUCKET/with-kms/TEST.md --sse aws:kms
aws s3 ls --recursive $TEST_BUCKET