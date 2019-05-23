[S3 Select](https://aws.amazon.com/blogs/aws/s3-glacier-select/) is an S3 feature that allows you to operate on JSON, CSV, and Parquet files in a row-based manner using SQL syntax. QUILT features experimental support for S3 Select queries as part of the `Bucket` interface:

```bash
$ python
>>> import quilt
>>> b = quilt.Bucket("s3://alpha-quilt-example")
>>> b.select("foo/bar.csv", "SELECT * FROM S3Object LIMIT 5")
<<< <pandas DataFrame object at ...>
```
