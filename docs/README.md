<!--
	Are you editing this file?
	* /README.md and docs/README.md should be identical copies (symlinks don't work)
	* Use only *absolute links* in these files. Relative links will break.
!-->
[![docs on_gitbook](https://img.shields.io/badge/docs-on_gitbook-blue.svg?style=flat-square)](https://quiltdocs.gitbook.io/quilt/)
[![chat on_slack](https://img.shields.io/badge/chat-on_slack-blue.svg?style=flat-square)](https://slack.quiltdata.com/)
[![codecov](https://codecov.io/gh/quiltdata/quilt/branch/master/graph/badge.svg)](https://codecov.io/gh/quiltdata/quilt)
[![pypi](https://img.shields.io/pypi/v/quilt.svg?style=flat-square)](https://pypi.org/project/quilt3/)

*Note: this is the documentation for [Quilt 3](https://blog.quiltdata.com/rethinking-s3-announcing-t4-a-team-data-hub-8e63ce7ec988). For Quilt 2 see [here](https://docs.quiltdata.com/v/quilt-2-master/) and [here](https://github.com/quiltdata/quilt/tree/quilt-2-master).*

## Overview

Quilt is a collaboration tool for creating, managing, and sharing
datasets in S3. Quilt users transform raw, messy data in S3 buckets
into immutable datasets--reusable, trusted building blocks that are
easy to version, test, share and catalog. Working with datasets in
Quilt speeds up model creation, accelerates experimentation, reduces
downtime, and increases the productivity of data science teams.

## A team data hub for S3

* Quilt adds search, content preview, versioning, and a Python API to any S3 bucket
* Every file in Quilt is versioned and searchable
* Quilt is for data scientists, data engineers, and data-driven teams

![](https://github.com/quiltdata/quilt/blob/master/docs/imgs/quilt.gif?raw=true)

### Use cases
* Collaborate - get everyone on the same page by pointing them all to the same immutable data version
* Experiment faster - blob storage is schemaless and scalable, so iterations are quick
* Recover, rollback, and reproduce with immutable packages
* Understand what's in S3 - plaintext and faceted search over S3

### Key features
* Browse, search any S3 bucket
* Preview images, Jupyter notebooks, [Vega visualizations](https://vega.github.io/) - without downloading
* Read/write Python objects to and from S3
* Immutable versions for objects, immutable packages for collections of objects

## Components

* `/catalog` (JavaScript) - Search, browse, and preview your data in S3
* `/api/python` - Read, write, and annotate Python objects in S3
