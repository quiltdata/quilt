# PARALLEL CHECKSUMS

## sha2-256-chunked

### 0xb518

This variant of sha2-256 is designed to enable very large files
to be uploaded and hashed in parallel using fixed size chunks
(8MiB to start with), with the final result being a "top hash"
that doesn't depend on the upload order.

The algorithm has an upper limit of 10,000 hashes.
If the file is larger than 80,000 MiB,
it will double the block size until the number of blocks
is under that limit.

Note that this algorithm only kicks in for files larger than or equal to 8 MiB.

* If the file is less than 8 MiB,
  the result will be identical to "serial" sha2-256.

* If the file is exactly 8 MiB
  the result will be the hash of that one block's hash.

This algorithm is compatible with Amazon's 
[S3 Checksums](https://aws.amazon.com/blogs/aws/new-additional-checksum-algorithms-for-amazon-s3/)
implementation, and identical with that being used by
[create_multipart_upload](https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/s3/client/create_multipart_upload.html)
as of at least [boto3 1.34.44](https://pypi.org/project/boto3/1.34.44/) 
(2024-02-16).

It has been submitted for
[multiformats registration](https://github.com/multiformats/multiformats/blob/master/contributing.md#multiformats-registrations)
under the name `sha2-256-chunked` using the prefix `0xb510`.
