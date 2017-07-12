# Valid package handles and package nodes
Package handles take the form `USER_NAME/PACKAGE_NAME`. The package name and the names of any package subtrees must be valid Python identifiers:
* Start with a letter
* Contain only alphanumerics and underscore

## Directory and file naming in `quilt generate`
* Directories and files that start with a numeric character will be prefixed with the letter `n`. If a name collision results, the build will fail with an error.
* If two files have the same path and root name, but different file extensions (`foo.txt`, `foo.csv`), the extensions will be appended as follows: `foo_txt`, `foo_csv`. If, after appending, there remains a name collision, the build will fail with an error.