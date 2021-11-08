# Git-like operations for data

`quilt3` provides a simple API for versioning large datasets and storing
them in Amazon S3. There are only three commands you need to know:
* `browse` is a lightweight way to surf package structure and metadata without copying any primary data
* `install` is a way to copy primary data from packages to a local disk
* `push` creates a new package revision in an S3 bucket that you designate

## But why not use Git?
In short, neither Git nor Git LFS have the capacity or performance to function
as a repository for data. S3, on the other hand, is widely used, fast, supports
versioning, and currently stores some trillions of data objects.

Similar concerns apply when baking datasets into Docker containers: images bloat
and slow operations down.

## Pre-requisites
In order to read from and write to S3 with `quilt3`, you must first do one of
the following:

* [Configure your AWS credentials](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html)
* If you use a Quilt enterprise stack, run `quilt3.login()

## Creating your first package

A package is a collection of related files, also called a "dataset." Packages
may contain data, metadata, documentation, visualization, models—anything you choose.
Common applications of packages include scientific analysis, training sets for 
machine learning, and dashboards.

Suppose you have a notebook and supporting data in a directory:
```bash
$ ls
README.md  data.csv  jupyter.ipynb  metadata.json
```

> In practice you want to avoid including files like `.DS_Store` and
> `.ipynb_checkpoints/` in your notebooks

