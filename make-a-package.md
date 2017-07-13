There are two ways to build data packages with Quilt:

1. Implicitly with `quilt build DIR`. Implicit builds are good for taking quick snapshots of unstructured data like images or text files. Data in implicit builds builds are not serialized to Parquet.
1. Explicitly with `quilt build FILE.YML`. Explicit builds allow fine-grained control over package names, types, and contents. Explicit builds serialize columnar data to Parquet.

Packages can be created directly from [Python](./python.md) or on the [command line](./shell.md).

# Implicit builds

To implicitly build a package of unserialized data:

```bash
quilt build USR/PKG DIRECTORY
```
Everything in `DIR` and it's subdirectories will be packaged into `USR/PKG`.

# Explicit builds
Explicit builds take their cues from a YAML file, conventionally called `build.yml`.

```bash
quilt build USR/PKG BUILD.YML
```

`build.yml` allows the user to control the structure, naming, and contents of a package. Read more about the syntax of `build.yml` [here](https://docs.quiltdata.com/buildyml.html).


Let’s start with some source data. How do we convert source files into a data package? We’ll need a configuration file, conventionally called build.yml. build.yml tells quilt how to structure a package. Fortunately, we don’t need to write build.yml by hand. quilt generate creates a build file that mirrors the contents of any directory:
$ quilt generate src
Let’s open the file that we just generated, src/build.yml:
contents:
  Fremont_Hourly_Bicycle_Counts_October_2012_to_present:
    file: Fremont_Hourly_Bicycle_Counts_October_2012_to_present.csv
  README:
    file: README.md
contents dictates the structure of a package.
Let’s edit build.yml to shorten the Python name for our data. Oh, and let’s index on the “Date” column:
contents:
  counts:
    file: Fremont_Hourly_Bicycle_Counts_October_2012_to_present.csv
    index_col: Date
    parse_dates: True
  README:
    file: README.md
counts — or any name that we write in its place — is the name that package users will type to access the data extracted from the CSV file. Behind the scenes, index_col and parse_dates are passed to pandas.read_csv as keyword arguments.
Now we can build our package:
$ quilt build YOUR_NAME/fremont_bike src/build.yml
...
src/Fremont_Hourly_Bicycle_Counts_October_2012_to_present.csv...
100%|███████████████████████████| 1.13M/1.13M [00:09<00:00, 125KB/s]
Saving as binary dataframe...
Built YOUR_NAME/fremont_bike successfully.
You'll notice that quilt build takes a few seconds to construct the date index.
The build process has two key advantages: 1) parsing and serialization are automated; 2) packages are built once for the benefit of all users — there’s no repetitive data prep.
Push to the registry
We’re ready to push our package to the registry, where it’s stored for anyone who needs it:
quilt login # accounts are free; only registered users can push
quilt push YOUR_NAME/fremont_bike
The package now resides in the registry and has a landing page populated by src/README.md. Landing pages look like this.
Packages are private by default, so you’ll see a 404 until and unless you log in to the registry. To publish a package, use access add:
quilt access add YOUR_NAME/fremont_bike public
To share a package with a specific user, replace public with their Quilt username.

# Valid package handles and package nodes
Package handles take the form `USER_NAME/PACKAGE_NAME`. The package name and the names of any package subtrees must be valid Python identifiers:
* Start with a letter
* Contain only alphanumerics and underscore

## Directory and file naming in `quilt generate`
* Directories and files that start with a numeric character or underscore will be prefixed with the letter `n`. If a name collision results, the build will fail with an error.
* If two files have the same path and root name, but different file extensions (`foo.txt`, `foo.csv`), the extensions will be appended as follows: `foo_txt`, `foo_csv`. If, after appending, there remains a name collision, the build will fail with an error.