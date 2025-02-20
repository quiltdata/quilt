# Packaging Engine

## Overview

The Quilt Packaging Engine in the Quilt Platform allows administrators and
developers to automate the process of creating Quilt packages from data stored
in Amazon S3. It serves as a key component in Quilt's SDMS (Scientific Data
Management System) strategy, enabling automated data ingestion and
standardization. It consists of:

1. Admin Settings GUI to enable package creation based on notifications from:
   1. AWS Health Omics
   2. Nextflow workflows using  `nf-prov`'s WRROC ([Workflow Run
      RO-Crate](https://www.researchobject.org/workflow-run-crate/)) format
2. SQS queue that will process package descriptions
3. Documentation for creating custom EventBridge rules to invoke that queue

## Admin Settings

The simplest way to enable package creation is through the Admin Settings GUI,
which supports the following built-in event sources:

![Admin Settings](../imgs/package-admin-gui.png)

### AWS Health Omics

When enabled, this will create a package from the `runOutputUri` provided in a
`aws.omics` completion event. For example, if the `runOutputUri` is
`s3://quilt-example/omics-quilt/3395667`, the package will be created in that
same bucket with the name `omics-quilt/3395667`.

### Workflow Run RO-Crate

When enabled, this will create a package when indexing any folder containing an
`ro-crate-manifest.json`.  Indexing happens when the bucket is added to the
stack, or when a folder is written to a bucket already in the stack.

[RO-Crate](https://www.researchobject.org/ro-crate/) is a metadata standard for
describing research data.  The Workflow Run working group adds three additional
profiles, which are supported in the latest versions of
[nf-prov](https://github.com/nextflow-io/nf-prov). You will need to explicitly
configure `nf-prov` to use `wrroc`, by using a `nextflow.config` file [like
this](https://github.com/famosab/wrrocmetatest):

```groovy
plugins {
 id 'nf-prov@1.4.0'
}

prov {
 enabled = true
 formats {
   wrroc {
     file = "${params.outdir}/ro-crate-metadata.json"
     overwrite = true
     agent {
       name = "John Doe"
       orcid = "https://orcid.org/0000-0000-0000-0000"
     }
      license = "https://spdx.org/licenses/MIT"
      profile = "provenance_run_crate"
   }
 }
}
```

Note that Research Objects identify people using an ORCID iD, which anyone can
get for free at [the ORDiD website](https://orcid.org/).

The package will be created in the same bucket as the `outdir`, with the package
name inferred from the S3 key. For example, if the key is
`my/s3/folder/ro-crate-manifest.json`, the package name will be `my_s3/folder`.

## SQS Message Processing

The primary interface to the Packaging Engine is through an SQS queue in the
same account and region as your Quilt stack, listed in `PackagerQueue` under the
Outputs. The queue URL will look something like:

```text
https://sqs.us-east-1.amazonaws.com/XXX/PackagerQueue-XXX
```

The body of the message is the stringified JSON of a package description.
There is only one required parameter:

```json
{
  "source_prefix": "s3://data_bucket/source/folder/metadata.json"
}
```

This is assumed to be a folder if it ends in a `/`; otherwise, we will remove
the last component of the path to get the folder. The contents of the folder
will be used create a package in the same bucket as the source folder, with the
package name being inferred from the source URI.

Optionally, you can control the package name, metadata, and other settings by
explicitly specifying any of the following fields:

```jsonc
{
  "source_prefix": "s3://data_bucket/source/folder/", // trailing '/' for folder
  "registry": "package_bucket", // may be the same as `data_bucket`
  "package_name": "prefix/suffix",
  "metadata": { "key": "value" }, // object
  "metadata_uri": "metadata.json", // S3 URI to read, relative or absolute
  "commit_message": "Commit message for the package revision", // string
  "workflow": "alpha", // name of a valid metadata workflow
}
```

### SendMessage API

If you have appropriate IAM permissions, and the SQS URL, you can send a message
to the queue using the AWS SDK or the AWS CLI. Here is an example using the AWS
CLI:

<!--pytest.mark.skip-->
```bash
export QUEUE_URL=https://sqs.us-east-1.amazonaws.com/XXX/PackagerQueue-XXX
aws sqs send-message --queue-url $QUEUE_URL \
--message-body '{"source_prefix":"s3://data_bucket/source/folder/"}'
```

## Custom EventBridge Rules

EventBridge rules can be used to transform any EventBridge event in your account
(from any bus, in any region) into a conforming SQS message.

### Example: Event-Driven Packaging (EDP)

EDP is a high-end add-on to Quilt that coalesces multiple S3 uploads into a
single `package-objects-ready` event, where it infers the appropriate top-level
folder. When ready, it creates an event like this on its own EventBridge bus:

```json
{
  "version":"0",
  "id":"XXXXXXXXXXXXXX",
  "detail-type":"package-objects-ready",
  "source":"com.quiltdata.edp",
  "account":"XXX",
  "time":"2022-12-08T20:01:34Z",
  "region":"us-east-1",
  "resources":[
    "arn:aws:s3:::bucket-name"
  ],
  "detail":{
    "version":"0.1",
    "bucket":"bucket-name",
    "prefix":"prefix-path-1/prefix-path-2/"
  }
}
```

Here is an example of an EventBridge rule you can write that will use the above
event to trigger packager queue:

```json
{
  "EventPattern": {
    "source": ["com.quiltdata.edp"],
    "detail-type": ["package-objects-ready"]
  },
  "State": "ENABLED",
  "Targets": [
    {
      "Id": "SQS_PackagerQueue",
      "Arn": "arn:aws:sqs:us-east-1:XXX:PackagerQueue-XXX",
      "InputTransformer": {
        "InputPathsMap": {
          "bucket": "$.detail.bucket",
          "prefix": "$.detail.prefix"
        },
        "InputTemplate": "{ \"source_prefix\":\"s3://<bucket>/<prefix>\" }"
      }
    }
  ]
}
```

## Caveats

1. The package creation process is asynchronous, so you may need to wait a few
   minutes before the package is available (longer if the source data is large).
2. If you send the same message multiple times before the folder is updated, it
   will not actually create a new revision, since the content hash will be the
   same. However, that would still waste computational cycles, so you should
   avoid doing so.
