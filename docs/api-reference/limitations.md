## Size 

By design, Quilt is backed by Amazon S3 and scales to billions of objects and
petabytes of data. The underlying limitations of S3 apply.

The Quilt catalog can browse packages and S3 buckets of any size.

### Catalog push

To ensure usability and quick package pushes, the Quilt web catalog imposes the
following limits on pushes (which vary depending on whether the chunked checksums
are enabled on the stack). These limits do not apply to the `quilt3` Python API.

 Dimension                                                  | Max (classic / chunked checksums)
------------------------------------------------------------|--------
 Package manifest size (metadata)                           | 100 MiB
 Package size (data; via promotion or from an S3 directory) | 100 GiB / 5 TiB
 Total size of uploaded files (soft limit)                  | 20 GB
 Total size of files from S3 (soft limit)                   | 50 GB / 5 TB
 Maximum file size                                          | 10 GiB / 5 TiB
 Maximum number of files per push (soft limit)              | 1,000
 Maximum number of files per push (hard limit)              | 5,000

### API

As of this writing, with sufficient client-side memory, you can comfortable scale
Quilt packages to at least one million objects per package, with no practical limit
on object size (save S3's 5 TB per object limit). A fast network, or better yet an AWS
compute instance in the same region as your Quilt S3 buckets, is recommended.

### Metadata

See [Metadata for teams](../Catalog/Metadata.md).
