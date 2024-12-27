 export TEST_BUCKET=s3://test-kms-policies
 aws s3 ls $TEST_BUCKET
 aws s3 cp TEST.md $TEST_BUCKET/
 aws s3 ls --recursive $TEST_BUCKET
