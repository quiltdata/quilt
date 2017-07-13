There are two ways to build data packages with Quilt:

1. Implicitly with `quilt build DIRECTORY`. Implicit builds are good for taking quick snapshots of unstructured data like images or text files. Quilt serializes columnar formats formats (xls, csv, tsv, etc.) to data frames; all other files will be copied "as is".

1. Explicitly with `quilt build FILE.YML`. Explicit builds allow fine-grained control over package names, types, and contents.

You can build packages in [Python](./python.md) or on the [command line](./shell.md).

# Implicit builds

To implicitly build a package of unserialized data:

```bash
quilt build USR/PKG DIRECTORY
```
Everything in `DIR` and it's subdirectories will be packaged into `USR/PKG`.

To publish your package:
```bash
quilt push USR/PKG --public
```
Users on Individual and Business plans can omit the `--public` flag to create private packages.

# Explicit builds

Explicit builds cue from a YAML file, conventionally called `build.yml`.

```bash
quilt build USR/PKG BUILD.YML
```

`build.yml` specifies the structure and contents of a package.

## `quilt generate`
An easy way to create a `build.yml` file is as follows:
```bash
quilt generate DIR
```
This command creates `build.yml` and `README.md` files that you can modify to your liking. A `README.md` file is highly recommended as it populates your package landing page with documentaiton.

You can read more about the syntax of `build.yml` [here](https://docs.quiltdata.com/buildyml.html) and in the [tutorial](./tutorial.md).

## `push`

Once `build.yml` reflects what you want in your package, you can push it to the registry:
```bash
quilt build USR/PKG build.yml
quilt push USR/PKG --public
```
Users on Individual and Business plans can omit the `--public` flag to create private packages.



# Valid package handles and package nodes
Package handles take the form `USER_NAME/PACKAGE_NAME`. The package name and the names of any package subtrees must be valid Python identifiers:
* Start with a letter
* Contain only alphanumerics and underscore

## Directory and file naming in `quilt generate`
* Directories and files that start with a numeric character or underscore will be prefixed with the letter `n`. If a name collision results, the build will fail with an error.
* If two files have the same path and root name, but different file extensions (`foo.txt`, `foo.csv`), the extensions will be appended as follows: `foo_txt`, `foo_csv`. If, after appending, there remains a name collision, the build will fail with an error.

***
