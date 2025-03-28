QUILT_PREFIX = ".quilt/"
NAMED_PACKAGES_PREFIX = QUILT_PREFIX + "named_packages/"
MANIFESTS_PREFIX = QUILT_PREFIX + "packages/"
USER_REQUESTS_PREFIX = "user-requests/"

LAMBDA_TMP_SPACE = 512 * 2 ** 20
LAMBDA_READ_TIMEOUT = 15 * 60  # lambda max running time

# 8 MiB -- boto3 default:
# https://boto3.amazonaws.com/v1/documentation/api/latest/reference/customizations/s3.html#boto3.s3.transfer.TransferConfig
MIN_PART_SIZE = 8 * 2**20  # 8 MiB
MAX_PART_SIZE = 5 * 2**30  # 5 GiB
MAX_PARTS = 10000  # Maximum number of parts per upload supported by S3
