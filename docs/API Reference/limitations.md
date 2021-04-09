## Size 

By design, Quilt is backed by Amazon S3 and scales to billions of objects and
petabytes of data. The underlying limitations of S3 apply.

The Quilt catalog can browse packages and S3 buckets of any size.

### Catalog push

To ensure usability and quick package pushes, the Quilt web catalog imposes
the following limits on pushes. These limits do not apply to the `quilt3` Python
API.


 Dimension                                                  | Max    
------------------------------------------------------------|--------
 Package manifest size (metadata)                           | 100 MB 
 Package size (data; via promotion or from an S3 directory) | 10 GB  
 Maximum mumber of files per push                           | 5,000  


### API

As of this writing, with sufficient client-side memory, you can comfortably scale
Quilt packages to one million objects with no practical limit on object size, outside
of S3's 5 TB per object limit.

### Metadata

See [Metadata](../Catalog/Metadata.md).
