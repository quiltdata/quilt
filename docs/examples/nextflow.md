<!-- markdownlint-disable -->
# Nextflow nf-quilt3

##  Technology preview
`nf-quilt3` is evolving rapidly and therefore is not yet recommended for production work.
You may encounter bugs and missing functionality.

## What is Nextflow?

[Nextflow](https://github.com/nextflow-io/nextflow) is a bioinformatics workflow manager that enables the
development of portable and reproducible workflows. The software
is used by scientists and engineers to write, deploy and share
data-intensive, highly scalable, workflows on any infrastructure.

## Overview

Nextflow plugin for interacting with [quilt packages](https://github.com/quiltdata/quilt) as a FileSystem.

`nf-quilt3` is a plugin developed by Quilt Data that enables you read and write directly to Quilt data packages using `quilt` URLs wherever you currently use `s3`, `az` or `gs` URLs.

## Getting Started

To add the `nf-quilt3` plugin to your workflow, you need Nextflow 22.09 (or later) and Python 3.9 (or later).

### Quilt Configuration

This plugin uses the `quilt3` CLI to call the Quilt API.
You must install the `quilt3` module and ensure the CLI is in your path:

<!--pytest.mark.skip-->
```bash
pip3 install quilt3
which quilt3 #e.g., /usr/local/bin/quilt3
```

### Reading and Writing Quilt URLs

Next, create a Quilt URL for the S3 bucket where you want to store (and eventually read) your results.
You must also specify a package name containing exactly one '/', such as `instrument/experiment`
Finally, run your Nextflow pipeline with your config file, setting that URL as your output directory, .e.g.:

<!--pytest.mark.skip-->
```
nextflow run nf-core/sarek -profile test,docker -plugins nf-quilt3 --outdir quilt+s3://raw-bucket#package=nf-quilt/sarek&path=.
```

### Pipeline Configuration

Note that you won't need the '-plugins' option if you modify `nextflow.config`

Add the following snippet to your `nextflow.config` to enable the plugin (or just that one 'id' if you already have other plugins):

<!--pytest.mark.skip-->
```groovy
plugins {
    id 'nf-quilt3'
}
```

In the future, you will be able to use that package as input to future jobs, e.g.:

<!--pytest.mark.skip-->
```
nextflow run my/analysis --indir quilt+s3://raw-bucket#package=experiment/instrument --outdir quilt+s3://prod-bucket#package=experiment/analysis
```

## Development

Based on [nf-hello](https://github.com/nextflow-io/nf-hello)

## Unit testing

Run the following command in the project root directory (ie. where the file `settings.gradle` is located):

<!--pytest.mark.skip-->
```bash
make check
```

## Testing and debugging

1. Clone the Nextflow repository into a sibling directory, .e.g:

<!--pytest.mark.skip-->
```bash
git clone --depth 1 https://github.com/nextflow-io/nextflow ../nextflow
```

2. Compile the plugin alongside the Nextflow code:
<!--pytest.mark.skip-->
```bash
make compile
```

3. Run Nextflow with the plugin, using `./launch.sh` as a drop-in replacement for the `nextflow` command, and adding the option `-plugins nf-quilt3` to load the plugin:

<!--pytest.mark.skip-->
```bash
./launch.sh run nextflow-io/hello -plugins nf-quilt3
```

## Package, upload and publish

The project should be hosted in a GitHub repository whose name should match the name of the plugin, that is the name of the directory in the `plugins` folder (e.g. `nf-quilt3`).

Follow these steps to package, upload and publish the plugin:

1. Create a file named `gradle.properties` in the project root containing the following attributes (this file should not be committed to Git):

* `github_organization`: the GitHub organisation where the plugin repository is hosted.
* `github_username`: The GitHub username granting access to the plugin repository.
* `github_access_token`: The GitHub access token required to upload and commit changes to the plugin repository.
* `github_commit_email`: The email address associated with your GitHub account.

2. Use the following command to package and create a release for your plugin on GitHub:

<!--pytest.mark.skip-->
```bash
./gradlew :plugins:nf-quilt3:upload
```

3. Create a pull request against [nextflow-io/plugins](https://github.com/nextflow-io/plugins/blob/main/plugins.json) to make the plugin accessible to Nextflow.

## References

* [Nextflow](https://nextflow.io)
* [nf-quilt3](https://github.com/quiltdata/nf-quilt3)
