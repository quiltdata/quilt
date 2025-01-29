# Quilt Packaging Service (QPS)

## Overview

The Quilt Packaging Service in the Quilt Platform allows administrators and
developers to automate the process of creating Quilt packages from data stored
in Amazon S3. It serves as a key component in Quilt's SDMS (Scientific Data
Management System) strategy, enabling automated data ingestion and
standardization. It consists of:

1. Admin Settings GUI to enable package creation for:
   1. AWS Health Omics
   2. `ro-crate-manifest.json` sentinel files
   3. Quilt's Event-Driven Packaging (EDP) system
2. An SQS queue that will process package descriptions
3. EventBridge rules for either an S3 URI or a full package description
4. A complete REST API for package creation

In addition to supporting your custom data pipelines, QPS can be used to build
integrations with genomics workflows and ELNs (Electronic Lab Notebooks).

_[TBD: Does this generate an SNS notice on completion?]_

## Admin Settings

The simplest way to enable package creation is through the Admin Settings GUI,
which supports the following built-in event sources:

![Admin Settings](../imgs/package-admin-gui.png)

### AWS Health Omics

When enabled, this will create a package from the URI provided in any
`aws.omics` event with `detail.status` of "COMPLETED".  For example, if the
`runOutputUri` is `s3://quilt-example/omics-quilt/3395667`, the package will be
created in that same bucket with the name `omics-quilt/3395667`.

### `ro-crate-manifest.json` Sentinel Files

When enabled, this will create a package from any folder containing an
`ro-crate-manifest.json`. [RO-Crate](https://www.researchobject.org/ro-crate/)
is a metadata standard for describing research data, which is also used by the
latest versions of [nf-prov](https://github.com/nextflow-io/nf-prov).

The package will be created in the same bucket as the sentinel file, using the
last two path components as the package name. If there are fewer than two
components, it will use a default prefix or suffix.

### Event-Driven Packaging (EDP)

EDP is a high-end add-on to Quilt that coalesces multiple S3 uploads into a
single `package-objects-ready` event, where it infers the appropriate top-level
folder.  When enabled, QPS will create a package from the `bucket` and `prefix`
provided in that event.

## SQS Message Processing

The primary interface to the Quilt Packaging Service is through the
`QuiltPackager` SQS queue in the same account and region as your Quilt stack,
i.e., `https://sqs.${AWS_REGION}.amazonaws.com/${AWS_ACCOUNT}/QuiltPackager`.

There are a wide range of low-code and no-code AWS services that can generate
SQS events. To use it, simply post a message whose body is the stringified JSON
of a package description:

```json
{
    "source_uri": "s3://data_bucket/folder/to/be/packaged",
    "registry": "s3://package_bucket",  // may be the same as `data_bucket`
    "pkg_name": "prefix/suffix",
    "metadata": { "key": "value" },  // optional dictionary
    "message": "Commit message for the package revision", // optional string
    "should_copy": false // optional boolean
    // false = point to data in the source bucket
    // true = copy data to the package bucket
}
```

## Default EventBridge Rules

For convenience, we also provide custom EventBridge rules that can be used to
create packages. Any event that matches one of these rules will be sent to the
`QuiltPackager` SQS queue.

1. The `detail-type` is `package-objects-request`
2. The `detail` must either be the package description (as above) or an S3 URI
   of the folder to package:

```json
{
    "uri": "s3://data_bucket/folder/to/be/packaged",
}
```

## Custom EventBridge Rules

You can write your own Rules that use Input Transformers to convert any event
into one of these formats. Here's an example of a Rule that will convert any SNS
Topic for S3 PutObject URIs that end in `manifest.json` into a package creation request:

```json
{
  "EventPattern": {
    "source": ["aws.s3"],
    "detail-type": ["Object Created"],
    "detail": {
      "bucket": { "name": ["bkt"] },
      "object": {
        "key": [{ "prefix": "path/to/folder/" }]
      }
    }
  },
  "Targets": [
    {
      "Id": "TargetID",
      "Arn": "arn:aws:events:region:account-id:event-bus/default",
      "InputTransformer": {
        "InputPathsMap": {
          "bucketName": "$.Records[0].s3.bucket.name",
          "objectKey": "$.Records[0].s3.object.key"
        },
        "InputTemplate": "{\
          \"detail-type\": \"package-object-request\", \
          \"detail\": { \"uri\": \"s3://<bucketName>/<objectKey>\" } \
        }"
      }
    }
  ]
}
```

## REST API Endpoints

In addition, you can create packages directly via the REST API,
available as the `PACKAGER_ENDPOINT` output of your Quilt stack.
The following methods are available:

```sh
GET /health          // Health check endpoint
GET /info            // Service information and configuration
GET /queue           // View messages in the packaging queue
POST /package/from-uri   // Create package from S3 URI
POST /package/from-args  // Create package with explicit arguments
```

### Package Creation Examples

Creating a package from a URI:

<!--pytest.mark.skip-->
```bash
curl -X POST $PACKAGER_ENDPOINT \
     -H "Content-Type: application/json" \
     -d '{"uri": "s3://bucket/path/to/data?key=value"}'
```
