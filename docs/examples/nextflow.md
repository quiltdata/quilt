# Nextflow nf-quilt

- [Nextflow](https://github.com/nextflow-io/nextflow) is a bioinformatics
workflow manager that enables the development of portable and reproducible
workflows. The software is used by scientists and engineers to write, deploy and
share data-intensive, highly scalable, workflows on any infrastructure.

- `nf-quilt` is a [Nextflow
plugin](https://www.nextflow.io/docs/latest/plugins.html) developed by Quilt
Data that enables you read and write directly to [Quilt data
packages](https://docs.quilt.bio) instead of just S3 locations.

## Quick Start

All you need to do is add the `nf-quilt` plugin to a Nextflow pipeline that
writes to Amazon S3.  The plugin will automatically create a Quilt package with
metadata from each run.  You can do this in one of three ways.

1. Add it to the command-line:

    <!--pytest.mark.skip-->
    ```sh
    nextflow run nf-core/rnaseq -plugins nf-quilt --outdir "s3://quilt-example-bucket/test/nf_quilt_rnaseq"
    ```

1. Include it in the nextflow config file (e.g., `main.nf`):

   ```groovy
   plugins {
       id 'nf-quilt'
   }
   ```

1. Specify it in the Advanced Options for a Seqera Platform job:

![Advanced Options > Nextflow config file](https://raw.githubusercontent.com/quiltdata/nf-quilt/master/README-Tower.png)

### Using Earlier Versions

To use older versions of `nf-quilt`, you can specify the version number of the
plugin using the '@' sign:

<!--pytest.mark.skip-->
```sh
nextflow run main.nf -plugins nf-quilt@0.7.16
```

### Using Prerelease Versions

To use unreleased versions of the `nf-quilt` plugin, you must  also set the
location using environment variable.  For example, to use version 0.8.6, set
`NXF_PLUGINS_TEST_REPOSITORY` from the command-line or the "Pre-run script" of
the Seqera Platform:

```sh
# export NXF_VER=23.04.3
export LOG4J_DEBUG=true  # for verbose logging
export NXF_PLUGINS_TEST_REPOSITORY=https://github.com/quiltdata/nf-quilt/releases/download/0.8.6/nf-quilt-0.8.6-meta.json
```

## Output and Input URIs

The canonical reference to a package is defined by a `quilt+` URI.  For example,
the `s3://quilt-example-bucket/test/nf_quilt_rnaseq` S3 URI will create a
package with the Quilt URI:

```string
quilt+s3://quilt-example-bucket#package=test/nf_quilt_rnaseq
```

You can then use that URI as input to future jobs, and similar URIs for the
output, e.g.,

<!--pytest.mark.skip-->
```bash
nextflow run my/analysis \
 --indir quilt+s3://quilt-example-bucket#package=test/nf_quilt_rnaseq.csv \
 --outdir quilt+s3://prod-bucket#package=experiment/analysis
```

### Additional Features

The `nf-quilt` plugin supports a wide range of additional options for
configuring input, output, and metadata. For more details, or to participate in
the development, please visit the
[quiltdata/nf-quilt](https://github.com/quiltdata/nf-quilt) GitHub repository.
