[![docs on_gitbook](https://img.shields.io/badge/docs-on_gitbook-blue.svg?style=flat-square)](https://docs.quiltdata.com/)
[![chat on_slack](https://img.shields.io/badge/chat-on_slack-blue.svg?style=flat-square)](https://slack.quiltdata.com/)
[![codecov](https://codecov.io/gh/quiltdata/quilt/branch/master/graph/badge.svg)](https://codecov.io/gh/quiltdata/quilt)
[![pypi](https://img.shields.io/pypi/v/quilt3.svg?style=flat-square)](https://pypi.org/project/quilt3/)

# Quilt is a self-organizing data hub

## Python Quick start, tutorials
If you have Python and an S3 bucket, you're ready to create versioned datasets with Quilt.
Visit the [Quilt docs](https://docs.quiltdata.com/installation) for installation instructions,
a quick start, and more.

## Quilt in action
* [open.quiltdata.com](https://open.quiltdata.com/) is a petabyte-scale open
data portal that runs on Quilt
* [quiltdata.com](https://quiltdata.com) includes case studies, use cases, videos,
and instructions on how to run a private Quilt instance
* [Versioning data and models for rapid experimentation in machine learning](https://medium.com/pytorch/how-to-iterate-faster-in-machine-learning-by-versioning-data-and-models-featuring-detectron2-4fd2f9338df5)
shows how to use Quilt for real world projects

## Who is Quilt for?
Quilt is for data-driven teams and offers features for coders (data scientists,
data engineers, developers) and business users alike.

## What does Quilt do?
Quilt manages data like code so that teams in machine learning, biotech,
and analytics can experiment faster, build smarter models, and recover from errors.

## How does Quilt work?
Quilt consists of a Python client, web catalog, lambda
functions&mdash;all of which are open source&mdash;plus
a suite of backend services and Docker containers
orchestrated by CloudFormation.

The backend services are available under a paid license
on [quiltdata.com](https://quiltdata.com).

## Use cases
* **Share** data at scale. Quilt wraps AWS S3 to add simple URLs, web preview for large files, and sharing via email address (no need to create an IAM role).
* **Understand** data better through inline documentation (Jupyter notebooks, markdown) and visualizations (Vega, Vega Lite)
* **Discover** related data by indexing objects in ElasticSearch
* **Model** data by providing a home for large data and models that don't fit in git, and by providing immutable versions for objects and data sets (a.k.a. "Quilt Packages")
* **Decide** by broadening data access within the organization and supporting the documentation of decision processes through audit-able versioning and inline documentation

## Roadmap
### I - Performance and core services
* [x] Address performance issues with push (e.g. re-hash)
* [x] Provide Presto-DB-powered services for filtering package repos with SQL
* [ ] Transition S3 manifests to [Apache Iceberg](https://iceberg.apache.org/) tables

### II - CI/CD for data
* [ ] Ability to fork/merge packages
* [ ] Data quality monitoring

### III - Storage agnostic (support Azure, GCP buckets)
* [ ] Evaluate min.io and ceph.io as shims
* [ ] Evaluate feasibility of on-prem local storage as a repo

### IV - Cloud agnostic
* [ ] Evaluate K8s and Terraform to replace CloudFormation
* [ ] Shim lambdas (consider serverless.com)
* [ ] Shim ElasticSearch (consider SOLR)
* [ ] Shim IAM via RBAC

