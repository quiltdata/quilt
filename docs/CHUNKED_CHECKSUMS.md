# Checksums and Hashing

Every entry in a Quilt package records a checksum (hash) of the object's
contents in the package manifest. Quilt uses these checksums to:

* Verify data integrity when a package is installed or verified
  (`Package.verify()`).
* Detect whether an object has changed since it was packaged.
* Produce the package *top hash*, which uniquely identifies each package
  revision by its contents.

Each manifest entry stores both the hash **type** and the hash **value**, so
packages created with different hash types remain valid and verifiable side
by side.

## Hash types

Quilt supports three hash types:

| Type | Encoding | Status |
| ------------------ | -------- | ------------------------------------- |
| `SHA256` | hex | Legacy (packages from `quilt3` < 6) |
| `sha2-256-chunked` | base64 | Default since `quilt3` v6 (Feb 2024) |
| `CRC64NVME` | base64 | Opt-in, stack-side only (see below) |

All three remain fully supported for verification: `quilt3` verifies
whichever hash type is recorded in the manifest. Verification of
`CRC64NVME` hashes requires `quilt3` 7.2.0 or later.

## The chunked hashing algorithm (`sha2-256-chunked`)

This variant of SHA2-256 is designed so that large files can be uploaded
and hashed efficiently in parallel using uniform-size chunks, with a final
result that does not depend on upload order:

1. Split the file into 8 MiB chunks.
1. Compute the SHA2-256 digest of each chunk (in parallel).
1. Concatenate the per-chunk digests and compute the SHA2-256 hash of the
   result. This is the recorded checksum, encoded as base64.

Edge cases:

* The algorithm has an upper limit of 10,000 chunks (matching the S3
  multipart part limit). For files larger than 80,000 MiB (~78 GiB), the
  chunk size is doubled until the chunk count is under that limit.
* Files smaller than 8 MiB are treated as a single chunk. The result is
  still wrapped, i.e. `sha256(sha256(data))`.
* A zero-byte file is treated as an empty list of chunks; its checksum is
  the SHA2-256 hash of the empty string.

Because the chunk boundaries match the multipart part sizes used for S3
uploads, Quilt can reuse the `ChecksumSHA256` values that S3 computes
during upload (or that are already stored on compliant multipart objects)
instead of re-reading the object — both in the `quilt3` client and in the
stack's packaging lambdas.

### Where hashing happens

* **`quilt3` SDK (`push`):** checksums are computed on the client, in
  parallel across chunks, and S3-provided checksums from the upload
  response are reused where possible. See the
  [FAQ](FAQ.md#hashing-during-push-takes-a-long-time-can-i-speed-it-up)
  for performance tuning.
* **Catalog and Packaging Engine:** packages created through the Catalog
  UI, the [Packaging Engine](Catalog/Packaging.md), or the `pkgpush` API
  are hashed server-side by dedicated lambdas that scale out
  automatically and reuse existing S3 checksums when the object's part
  layout is compliant.

## CRC64/NVME checksums (experimental)

For files already in S3, packaging can be up to 10x faster by using S3's
native CRC64/NVME checksums instead of computing SHA-256 hashes.

Since AWS enabled default data-integrity protections (early 2025), S3
automatically computes and stores a full-object `CRC64NVME` checksum for
objects uploaded with current AWS SDKs, the AWS CLI, or the S3 console.
When CRC64/NVME support is enabled on your Quilt stack, the packaging
lambdas read that precomputed checksum with a metadata request instead of
downloading and re-hashing the object.

Objects that do not have a precomputed `CRC64NVME` checksum (for example,
objects uploaded before the AWS integrity changes or with older tooling)
automatically fall back to `sha2-256-chunked` hashing, so a single package
may contain entries with both hash types.

### How to enable

CRC64/NVME checksums are **opt-in**, controlled by a CloudFormation stack
parameter:

1. In the AWS Console, go to CloudFormation > Stacks > *YourQuiltStack* >
   Update.
1. Choose **Use current template**.
1. Under **Beta features**, set `CRC64Checksums` to `Enabled`.
1. Complete the stack update.

Requirements:

* Quilt Platform release 1.65.0 (December 2025) or later.
* `quilt3` 7.2.0 or later on any client that needs to *verify* packages
  containing `CRC64NVME` hashes (older clients can still install and read
  such packages).

Notes:

* This setting affects server-side packaging (Catalog UI, Packaging
  Engine, `pkgpush`). The `quilt3` client continues to compute
  `sha2-256-chunked` checksums on `push`.
* The feature is experimental. To revert, set `CRC64Checksums` back to
  `Disabled`; existing packages remain valid because the hash type is
  recorded per entry.

## Verifying package integrity

`Package.verify()` recomputes the checksum of each local file against the
hash type and value recorded in the manifest and reports any mismatches:

<!--pytest.mark.skip-->
```python
import quilt3

p = quilt3.Package.browse(
    "user/package",
    registry="s3://your-bucket",
)
p.verify("path/to/local/copy")
```

## Inspiration

The chunked algorithm is inspired by Amazon's
[S3 Checksums](https://aws.amazon.com/blogs/aws/new-additional-checksum-algorithms-for-amazon-s3/)
implementation.

The key differences are:

* Fixing the chunk size as (starting from) 8 MiB.
* Always hashing the result (even if source_size < 8 MiB).

It can reuse hashes generated by
[create_multipart_upload](https://boto3.amazonaws.com/v1/documentation/api/latest/reference/services/s3/client/create_multipart_upload.html)
as of at least [boto3 1.34.44](https://pypi.org/project/boto3/1.34.44/)
(2024-02-16), simply by rehashing the value if source_size < 8 MiB.

<!-- markdownlint-disable line-length -->
## Multiformats Registration

* Name: sha2-256-chunked
* Prefix: 0xb510
* Status: draft
* Type: multihash
* Description: Hash of concatenated SHA2-256 digests of 8*2^n MiB source chunks; n = ceil(log2(source_size/(10^4*8MiB)))
* Registrar: [multiformats/multicodec](https://github.com/multiformats/multicodec)
* Registration Date: [2024-02-23](https://github.com/multiformats/multicodec/pull/343)
