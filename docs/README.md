<!--
	Are you editing this file?
	* /README.md and docs/README.md should be identical copies (symlinks don't work)
	* Use only *absolute links* in these files. Relative links will break.
!-->
[![docs on_gitbook](https://img.shields.io/badge/docs-on_gitbook-blue.svg?style=flat-square)](https://docs.quiltdata.com/)
[![chat on_slack](https://img.shields.io/badge/chat-on_slack-blue.svg?style=flat-square)](https://slack.quiltdata.com/)
[![codecov](https://codecov.io/gh/quiltdata/quilt/branch/master/graph/badge.svg)](https://codecov.io/gh/quiltdata/quilt)
[![pypi](https://img.shields.io/pypi/v/quilt3.svg?style=flat-square)](https://pypi.org/project/quilt3/)

> Below is the documentation for [Quilt 3](https://quiltdata.com/). See [here](https://docs.quiltdata.com/v/quilt-2-master/) and [here](https://github.com/quiltdata/quilt/tree/quilt-2-master) from Quilt 2.

## Overview

* Quilt is a versioned data portal for AWS.
* Quilt is for data-driven teams of both technical
and non-technical members (executives, data scientists, data engineers, sales, product, etc.)
* Quilt adds search, visual content preview, and
versioning to every file in S3
* Quilt consists of a Python client, Web catalog, and a suite of backend services
controlled by CloudFormation.

## Use cases

Quilt handles five key use cases:
* **Share** data at scale. Quilt wraps AWS S3 to add simple URLs, web preview for large files, and sharing via email address (no need to
create an IAM role).
* **Understand** data better through inline documentation
(Jupyter notebooks, markdown) and visualizations (Vega, 
Vega Lite)
* **Discover** related data by indexing objects in 
ElasticSearch
* **Model** data by providing a home for large data and models that don't fit in git, and by providing immutable
versions for objects and data sets (a.k.a. "Quilt Packages")
* **Decide** by broadening data access within the organization
and supporting the documentation of decision
processes through audit-able versioning and inline
documentation

## Which code is open source?
The web catalog, Python client, and all lambda functions
are open source under the Apache v2 license.
The CloudFormation templates
and containers that run the services can be licensed for private use on [quiltdata.com](https://quiltdata.com).

## Roadmap

### I - Performance and core services
* [ ] Address performance issues with push (e.g. re-hash)
* [ ] Refactor `bucket/.quilt` for improved listing
and delete performance

### II - CI/CD for data
* [ ] Ability to fork/merge packages (via manifests in git)
* [ ] Automated data quality monitoring

### III - Storage agnostic (support Azure, GCP buckets)
* [ ] evaluate min.io and ceph.io
* [ ] evaluate feasibility of local storage (e.g. NAS)

### IV - Cloud agnostic
* [ ] K8s deployment for Azure, GCP
* [ ] Shim lambdas via serverless.com?
* [ ] Shim ElasticSearch via SOLR?
