# Quilt Package use cases

## Introduction

This document outlines several key use cases and proposes code samples to satisfy
those use cases. Both use cases and code samples are open to discussion.

The document is about UX, not implementation. It does not address performance,
but the expectation is that performance will be acceptable for common case activities
with data sets with one to ten million entries.

API names are rough and open to improvement.

## Mental model
### Definitions
* A _data package_ is a versioned, reusable dataset that is represented
as a (potentially empty) list of tuples known as a _manifest_.
* An _entry_ to a manifest is tuple with four dimensions:
`(logical_key, physical_key, hash, metadata)`.
    * _logical key_ (`train/image14.jpg`) is a user-friendly name for the data
    present at the _physical key_
    * _physical key_ (`s3://quilt-train-sets/MNIST/images/24.jpg`) is a URI to a
    stream of bytes (typically an object in S3).
    * _hash_ (`s3://quilt-train-sets/MNIST/images/24.jpg`) is a [cryptographic]
    hash that uniquely identifies the contents of _physical key_
    * _metadata_ is an aribtrary dictionary that can be successfully serialized
    as JSON (but need not stored as JSON)
* An _instance_ of a data package is represented by a handle of the form
`STRING:HASH`, where HASH is a [cryptographic] hash function of the entries in
the underlying package manifest; STRING usually takes the form `BUCKET/NAME`.
By convention package instances are _immutable_ and the underlying 
physical keys are expected to be present for all time, in order to support
reproducibility and audit-ability. For this reason, Quilt packages require
an S3 bucket with object versioning enabled.
* A package _repository_ is a structured collection of package instances that live
in blob storage. The structure of a repository is the _repository schema_.

### API primitives
> this section need work; goal is to specify basic API primitives
and how those actions cohere with the mental model

## Stream training data to PyTorch jobs
> "Stream" is a loaded worded but "acquire" doesn't work because the data
have already been acquired and labeled. Quilt's job is more "get data into
model"

> What does it mean to reproduce the model? Rehydrate the trained model? Recreate
the training set? Under which circumstance is the need to reproduce felt? Said
circumstance should be a separate job.

> Refactored into JTBD with a "so what" reason

* When I am preparing to train a model
* I would like an API that quickly feeds the training jobs with data that looks
like it comes from local folders
* So that I can focus on optimizing model performance, and worry less about data

### Command Line
```
$ quilt copy bucket/dataset:hash --to /my/path/to/data
Copying Package bucket/dataset:hash to ./dataset/...

$ quilt diff bucket/dataset:hash ./dataset
No changes

$ quilt hash ./dataset
18b6a77a6ab31d304f03e01561fbc755b44746b376bcd85e6d226948876470b3
```
> We don't need a separate hash command if status shows the hash (and it does)?

> Why default to `:tag` and not [short] hash? Hashes will _always_ be there,
whereas tags require more user action and more API surface.

> Need to be deliberate about "copy" vs. "install". The latter implies
additional accounting such that subsequent API invocations always know where to
find the data. "Install" is standard for package managers but again always
implies that the contents of the install are callable/importable from code
or CLI.


### Python
```
from quilt3 import Package

pkg = Package("bucket/dataset:hash")
pkg.copy(to="my/path/to/data")

pkg.diff("./dataset")
{
    'added': [],
    'modified': [],
    'deleted': [],
    'hash': '18b6a77a'
}
```
> `diff` is truer to what we are doing, no? can also support different args
e.g. `pkg.diff(other_pkg)`

> Is the change from "install" to "download" (in the original) deliberate?


## Publish a dataset

- When I have new data that's beneficial to the community
- I'd like to publish the data set in a format that looks professional
(documented, reflects well on me), requires little maintenance,
and is easy for my collaborators to browse, download, and split
- So that my collaborators can train more accurate models

> TODO: Field a question on the data (as separate use case)

### Scripting Python API

Add a directory, build the manifest manually, push the data to s3, push the manifest
to s3 (will build the manifest so user doesn't have to do that step by hand).

Force difference between Package and PackageBuilder.

By default enforce best practices, but allow users to explicitly avoid them:
- Don't point to local files
- Don't work with a package if the manifest is not in s3

Metadata on directory is still unclear.
> Why wouldn't we just support directory-level keys in the manifest
(as we do today) that support metdata annotations

#### Create a PackageBuilder and add a directory
```
# it is kinda nice for packages to be anonymous and then named on push
# (at least that is more flexible)
> pkg_builder = PackageBuilder("bucket/dataset")

# So the default is logical_key == physical_key?
# i.e. how does the API know where to find the README.md below?
# The logical / physical key separation is an important concept
# that we should be thoughtful in sugaring over it?

> pkg_builder.add("README.md")
> pkg_builder.add("train2017/")
> pkg_builder
PackageBuilder(
  name: "bucket/dataset",
  # Why even show these fields if they aren't meaningful and this
  # isn't a package?
  tophash: "pre-manifest",
  manifest: "pre-manifest"
  contents: [
    "README.md"  -> "./README.md"
    "train2017/" -> "./train2017/..."
  ]
)
```

#### Hash and build manifest.
```
# shouldn't we return something instead of just having a side-effect on the object?
# at the very least we should support method chaining?
# `build_manifest` could even return itself or a manifest object.
> pkg_builder.build_manifest()

Building manifest...
Tophash: 82111d74b46893c539e816a1119891362049b7a744dd1e188b58751a8ec58b73
> pkg_builder
PackageBuilder(
  name: "bucket/dataset",
  tophash: "82111d74b46893c539e816a1119891362049b7a744dd1e188b58751a8ec58b73",
  manifest: "local"
  # since push_data has behavior conditional on the physical keys location, ditto
  # for .as_package(), we should state right here in the REPL whether or not
  # `contents` contains local keys
  # this way we help people do their book-keeping as they get the packge ready
  # for publication
  contents: [
    "README.md"  -> "./README.md"
    "train2017/" -> "./train2017/..."
  ]
)
```

#### Try to use this PackageBuilder as a Package. Reject unless user explicitly
indicates they want to avoid best practices
Another potential exception would be if there is no README file.
```
> pkg = pkg_builder.as_package()
Exception: Manifest contains pointers to local files. Use push_data() to first push those files to s3 or use allow_local_files=True if this is intentional  
Exception: The manifest has not been pushed to a remote repository. Use push_manifest() to first push the manifest to s3 or use allow_local_manifest=True if this is intentional
```

#### Push the local data to s3 and update the pointers. The manifest is still local
```
# What _exactly_ gets copied when push is called? All non-S3 keys get copied
# to s3://bucket/prefix? What about phyisical keys that are already s3://*?
What about file:/// keys? What if I push to a local NAS instead of S3?

> pkg_builder.push_data(
    # we need to be explicit about the bucket
    bucket="s3://bucket",
    # Or maybe volume= to support both s3:// and file:///
    prefix="/data/dataset/v0/val2017"
)
Pushing ./train2017/ to s3://bucket/data/dataset/v0/train2017/...
Pushing ./README.md to s3://bucket/data/dataset/v0/README.md

> pkg_builder
PackageBuilder(
  name: "bucket/dataset",
  tophash: "82111d74b46893c539e816a1119891362049b7a744dd1e188b58751a8ec58b73",
  # is it in fact in memory?
  manifest: "local (in memory)"
  contents: [
    "README.md"  -> "s3://bucket/data/dataset/v0/README.md"
    "train2017/" -> "s3://bucket/data/dataset/v0/train2017/..."
  ]
)
```
#### Try to use PackageBuilder as Package. Reject as the manifest is not in s3 so it is not reproducible
```
> pkg = pkg_builder.as_package()
Exception: The manifest has not been pushed to a remote repository. Use push_manifest() to first push the manifest to s3 or use allow_local_manifest=True if this is intentional
```
> is `push` just syntactic sugar for `push_data` followed by `push_manifest`?

#### Push the manifest to s3 - now the user has a Package.
```

# Do we want to enforce and order around push_data and push_manifest?
# We probably should, else we'll have broken manifests
# I guess `push` can handle order?
> pkg = pkg_builder.push_manifest(tag="v0")
Pushing manifest to s3://bucket/.quilt/PACKAGE=dataset/HASH_PREFIX=82/82111d74b46893c539e816a1119891362049b7a744dd1e188b58751a8ec58b73.jsonl
Linking data/package:v0 to manifest 82111d74b

> pkg
Package(
  name: "bucket/dataset:v0",
  tophash: "82111d74b46893c539e816a1119891362049b7a744dd1e188b58751a8ec58b73",
  manifest: "s3://bucket/.quilt/PACKAGE=dataset/HASH_PREFIX=82/82111d74b46893c539e816a1119891362049b7a744dd1e188b58751a8ec58b73.jsonl",
  # here and elsewhere, contents should show the tuples instead of this mapping?
  contents: [
    "README.md"  -> "s3://bucket/data/dataset/v0/README.md"
    "train2017/" -> "s3://bucket/data/dataset/v0/train2017/..."
  ]
)

> pkg_builder.as_package()
PackageBuilder(
  name: "bucket/dataset:v0",
  tophash: "82111d74b46893c539e816a1119891362049b7a744dd1e188b58751a8ec58b73",
  manifest: "s3://bucket/.quilt/PACKAGE=dataset/HASH_PREFIX=82/82111d74b46893c539e816a1119891362049b7a744dd1e188b58751a8ec58b73.jsonl",
  contents: [
    "README.md"  -> "s3://bucket/data/dataset/v0/README.md"
    "train2017/" -> "s3://bucket/data/dataset/v0/train2017/..."
  ]
)
```

#### A Package cannot be altered. You need a PackageBuilder to make changes
Unclear the best representation of meta when displaying a Package/PackageBuilder
```
> pkg.set("train2017/1.jpg", "./replacement/1.jpg", meta={})
Exception: Package has no method set().

# we want to_package_builder() and to_package() instead of "as"
# because as implies a continued relationship with the original
> pkg_builder_2 = pkg.as_package_builder()
> pkg_builder_2.set("train2017/1.jpg", "./replacement/1.jpg", meta={})
> pkg_builder_2
PackageBuilder(
  name: "bucket/dataset",
  tophash: "pre-manifest",
  contents: [
    "README.md"             ->    "s3://bucket/data/dataset/v0/README.md"
    "train2017/..."         ->    "s3://bucket/data/dataset/v0/train2017/...",
    "train2017/1.jpg"       ->    "./replacement/1.jpg"
  ]
)
```

#### You can push both the data and the manifest together if you want, but it is not the default behavior
Pushing the manifest implicitly builds the manifest for you
```

> pkg = pkg_builder_2.push_data_and_manifest(prefix="/data/dataset/v0/val2017")
Pushing ./train2017/ to s3://bucket/data/dataset/v0/train2017/... (data exists, skipping)
Pushing ./replacement/1.jpg to s3://bucket/data/dataset/v0/train2017/1.jpg

Building manifest...
Tophash: 3e6e97cccc554c210a5e6eb70f77367fd05abfd4c4da5847f97fa13439e62448

Pushing manifest to s3://bucket/.quilt/PACKAGE=dataset/HASH_PREFIX=3e/3e6e97cccc554c210a5e6eb70f77367fd05abfd4c4da5847f97fa13439e62448.jsonl

> pkg
Package(
  name: "bucket/dataset",
  tophash: "3e6e97cccc554c210a5e6eb70f77367fd05abfd4c4da5847f97fa13439e62448"
  contents: [
    "README.md"  -> "s3://bucket/data/dataset/v0/README.md"
    "train2017/" -> "s3://bucket/data/dataset/v0/train2017/..."
  ]
)
```




## use case: Explore Dataset

- I found a potentially useful dataset and I want to explore it to see if it will be useful. I want to be able read any documentation that is available for the dataset. I want to explore the structure of the dataset (folders, schemas). I want to be able to interactively explore individual pieces of data, for example going through images+labels one-by-one. I want to be able to very quickly determine if this dataset is useless to me - I do not want to have to wait (for example due to downloading the full dataset).

> How do we solve Jackson's problem of lazy / lightweight browsing of the package
without downloading a huge manifest?

> How do we solve the catalog's problem of browsing a huge (e.g. 10M lines)
manifest without flooding the browser?

> In both cases it seems we should be able to walk the package tree lazily and
cheaply


### Interactive Jupyter/Python API
```
# need to specify `registry=`, right? how does the API know where to look in S3
# or on the NAS?
> pkg = Package("bucket/dataset")
# do we want to keep the existing REPR tree? it's useful
# how is this set? why not pkg['README.md'] instead?
> readme = pkg.readme()
> readme
# Dataset

Here is some info about our dataset...

> top_level_contents = pkg.ls()
> top_level_contents
README.md
cats/
dogs/
rats/
other/

# do we need `recursive=True`?
> cats_contents = pkg.ls("cats/")
> cats_contents
cats/file1.txt
cats/tabby/

# what is get_contents? same as boto3.get_object?
> file1_contents = pkg.get_contents("cats/file1.txt")
> file1_metadata = pkg.get_metadata("cats/file1.txt")


# depending on how laziness goes, we may or may not have the manifest and its
# entries at this point? e.g. what if you wanted to inspect based on metadata?
# isn't the data that we need to browse the package a subset of the full manifest
# by design?
> files_to_inspect = [entry.logical_key
                      for entry
                      in pkg.ls("cats/")
                      if entry.is_file()]
```

> caching is high value; not sure if we should tackle in v1

> how does caching relate to things like fsx? who manages the cache?

> OK (and maybe smart) to make this a premium feature that requires extra
configuration

Caching to interactively work with large files.
```
> %time pkg.get("other/huge_file.json")
CPU times: user 123 s, sys: 253 µs, total: 123 s
Wall time: 123 s

> %time pkg.cache("other/huge_file.json")
CPU times: user 123 s, sys: 253 µs, total: 123 s
Wall time: 123 s

> %time large_file_contents = pkg.get("other/huge_file.json")
CPU times: user 1 s, sys: 253 µs, total: 1 s
Wall time: 1 s

> pkg.clear_cache()  # We need the user to tell us we can clear the cache
```


## use case: Add new data to dataset
- I have just acquired more data (for example, from a data labelling service) and I want to add that new data to our primary dataset so we can train on it using existing pipelines. Most likely I have acquired a new batch of data, but it is also possible that I am constantly adding new data points one at a time. I want to create a new 'version' of the dataset each time I acquire new data, but I only want to train every X hours/days/weeks. It is important that I am able to rollback my dataset to a previous point in time in case the results of training indicates a problem with the new data.

### Acquire new labels (JTBD)
- When I acquire new data from a labeling service
- I'd like to create a new version of an existing dataset
- So that my team can retrain downstream models, improving performance

### Roll back to known-good labels (JTBD)

- If the labels prove incorrect or a model starts to drift
- I'd like the team to be able to roll back to prior, known-good training sets
- So that we can quickly recover from errors

#### Create a new Package by adding one Package to another
In this example, we assume the new data is stored as a Package
```
# added s3:// prefix to be explicit about data location
# we should also have proper URI handling to distinguish local and S3 cases?
> new_data = Package("s3://bucket/new-data:2019-10-30")
> new_data
Package(
  name: "bucket/new-data:2019-10-30",
  tophash: "82111d74b46893c539e816a1119891362049b7a744dd1e188b58751a8ec58b73"
  contents: [
    "new_data/" -> "s3://bucket/data-labelling-service/2019-10-30/..."
  ]
)

# this all looks good but assumes branches and tags, which we don't have and
# are non-trivial? shouldn't we just rely on hashes for now?
> main_dataset = Package("bucket/dataset:master")
> main_dataset
Package(
  name: "bucket/dataset:master",
  tophash: "3e6e97cccc554c210a5e6eb70f77367fd05abfd4c4da5847f97fa13439e62448"
  contents: [
    "labelled/" -> "s3://bucket/data/dataset/labelled/..."
  ]
)

> pkg_builder = main_dataset.as_package_builder()
> pkg_builder
PackageBuilder(
  name: "bucket/dataset:master",
  tophash: "pre-manifest",
  contents: [
    "labelled/..." ->  "s3://bucket/data/dataset/labelled/...",
  ]
)

# we should be explicit about what happens when there is a logical-name conflict
> pkg_builder.add(new_data)
> pkg_builder
PackageBuilder(
  name: "bucket/dataset:master",
  tophash: "pre-manifest",
  contents: [
    "labelled/..." ->  "s3://bucket/data/dataset/labelled/...",
    "new_data/..." ->  "s3://bucket/data-labelling-service/2019-10-30/..."
  ]
)
```
> Consider using `diff` above. As in, it's very useful to the publisher to know
how many labels changed, how many were added, etc. This would be an add/modify/
delete breakdown.

#### Allow logical key renaming. Fail on collisions by default
```
# if we're going to throw an exception, shouldn't the remedy be to delete first
# and then overwrite, instead of overwrite=True? 
> pkg_builder.move_dir_contents("new_data/", "labelled/")
Exception: Collision detected. moving "new_data/1.jpg" to "labelled/1.jpg", but "labelled/1.jpg" already exists. Use overwrite=True if you would like to replace "labelled/1.jpg" with "new_data/1.jpg".

> pkg_builder.move_dir_contents("new_data/", "labelled/", overwrite=True)
> pkg_builder
PackageBuilder(
  name: "bucket/dataset:master",
  tophash: "pre-manifest",
  contents: [
    "labelled/..." ->  "s3://bucket/data/dataset/labelled/...",
    "labelled/..." ->  "s3://bucket/data-labelling-service/2019-10-30/..."
  ]
)

# what happens if tag master already exists? over-write?
# move the tag from the old package?
> pkg = pkg_builder.push_manifest(tag="master")
Building manifest...
Tophash: 3e6e97cccc554c210a5e6eb70f77367fd05abfd4c4da5847f97fa13439e62448

Pushing manifest to s3://bucket/.quilt/PACKAGE=dataset/HASH_PREFIX=3e/3e6e97cccc554c210a5e6eb70f77367fd05abfd4c4da5847f97fa13439e62448.jsonl
Linking data/package:master to manifest 3e6e97c
```

#### Incremental Download for Consumers
The user needs to be able to download only the minimum amount of data required to make local files match the new Package. Small updates to large packages should be fast.
```
# what about installing sub-directories? (i guess we can support installing
# filtered subsets later, via metadata service)

> pkg = Package("bucket/dataset:removed_some_items_changed_one_item")
> pkg.download("./dataset")
> pkg.verify_directory_matches_manifest("./dataset")
False
./dataset/file1.txt exists locally, but does not exist in the manifest bucket/dataset:removed_some_items_changed_one_item
./dataset/file2.txt exists locally, but does not exist in the manifest bucket/dataset:removed_some_items_changed_one_item
./dataset/file3.txt exists locally, but contents do not match manifest bucket/dataset:removed_some_items_changed_one_item
This can be fixed by calling pkg.force_directory_to_match_manifest("/dataset")
> pkg.force_directory_to_match_manifest("/dataset")
Changes:
  ./dataset/file1.txt removed
  ./dataset/file2.txt removed
  ./dataset/file3.txt replaced with s3://bucket/dataset/new_file3.txt

> pkg.verify_directory_matches_manifest("./dataset")
True
```

## use case: Improve dataset
- My regular training has identified incorrect labels. I want to create a new dataset that corrects those incorrect labels by replacing them with correct labels.

```
> pkg = Package("bucket/dataset:master")
> pkg
Package(
  name: "bucket/dataset:master",
  tophash: "82111d74b46893c539e816a1119891362049b7a744dd1e188b58751a8ec58b73"
  contents: [
    "labelled/" -> "s3://bucket/data/dataset/labelled/...",
  ]
)

> pkg_builder = pkg.as_package_builder()
> pkg_builder.set_meta("labelled/1.jpg", meta={})

```

## use case: Store Entire Workspace
- I have finished an ML training job and I want to make the results reproducible. I want to save the training outputs along with references to the code+data+environment (git+quilt+docker) that created the model.

#### Python API
```
> PackageBuilder("bucket/temp:2019-10-31").add(".").push_data_and_manifest(prefix="armand/temp/2019-10-31/")
```

#### Command Line API
```
```







## Other use cases
- I want to create a new dataset by sampling for another dataset. This could be to create a representative, smaller dataset for testing. This could also be to bootstrap a training dataset from a publicly available datasets such as OpenImages. I do not want to have to download the entire larger dataset.

- I want to run code that transforms a dataset into a new dataset. For example, this could be taking an image dataset and resizing/extracting crops. This could also be taking a JPEG dataset and creating an equivalent TFRecord dataset. Given the potentially large size of the initial dataset, I will likely want to use some distributed system. I want to be able to use whatever distributed processing framework I currently have a cluster for.

- I want to perform a specific ML task. I have found a high-quality implementation on GitHub. I have labeled data necessary for the task. I want to confirm that I have formatted my data in a way that will work with the implementation - and I do not want to have to actually spend expensive compute to find out by training.







## Command Line code samples that aren't realistic in the near-term

> as a simplification and to make schedule, we could punt all command-line
package building; and instead rely on PackageBuilder in Python
(with the understanding that on-disk statefulness is nontrivial)

> said another way, if CLI only supports data acquisition and browsing, that's
enough to start with; PackageBuilder can carry the remaining weight

Virtualize filesystem to make installation fast.

```
$ quilt install bucket/dataset:tag --location ./dataset --lazy-download
Installing Package bucket/dataset:tag to ./dataset/...

$ quilt init bucket/dataset
New PackageBuilder bucket/dataset created

$ quilt add train2017/
Adding contents of directory ./train2017/ to bucket/dataset as train2017/...

$ quilt add val2017/ s3://otherbucket/abc/validation/
Adding objects in s3://bucket/abc/validation/ to bucket/dataset as val2017/...

$ quilt status
PackageBuilder: bucket/dataset (pre-manifest)

Data:
  train2017/    ->  ./train2017/
  val2017/      ->  s3://otherbucket/abc/validation/

$ quilt build-manifest
Building manifest...
Tophash: 82111d74b46893c539e816a1119891362049b7a744dd1e188b58751a8ec58b73

$ quilt status
PackageBuilder: bucket/dataset (82111d74b)

Data:
  train2017/    ->  ./train2017/
  val2017/      ->  s3://otherbucket/abc/validation/

$ quilt push-data --prefix=data/dataset/v0/ --local-files-only
Pushing ./train2017/ to s3://bucket/data/dataset/v0/train2017/...

$ quilt status
PackageBuilder: bucket/dataset (82111d74b)

Data:
  train2017/    ->  s3://bucket/data/dataset/v0/train2017/
  val2017/      ->  s3://otherbucket/abc/validation/

$ quilt push-data --prefix=data/dataset/v0/
Pushing ./train2017/ to s3://bucket/data/dataset/v0/train2017/... (data exists, skipping)
Copying s3://otherbucket/abc/validation/ to s3://bucket/data/dataset/v0/val2017/...

$ quilt status
PackageBuilder: bucket/dataset (82111d74b)

Data:
  train2017/    ->  s3://bucket/data/dataset/v0/train2017/
  val2017/      ->  s3://bucket/data/dataset/v0/val2017/

$ quilt push-manifest -t v0
Pushing manifest to s3://bucket/.quilt/PACKAGE=dataset/HASH_PREFIX=82/82111d74b46893c539e816a1119891362049b7a744dd1e188b58751a8ec58b73.jsonl
Linking data/package:v0 to manifest 82111d74b

$ quilt status
Package: bucket/dataset:v0 (82111d74b)
Data matches manifest

$ quilt add test2017/ ../test2017/
Adding contents of directory ../test2017/ to bucket/dataset as test2017/...

$ quilt status
PackageBuilder: bucket/dataset (pre-manifest)

Data:
  train2017/    ->  s3://bucket/data/dataset/v0/train2017/
  val2017/      ->  s3://bucket/data/dataset/v0/val2017/
  test2017/     -> ../test2017/

$ quilt set train2017/1.jpg ./replacement/1.jpg
Setting logical key train2017/1.jpg as ./replacement/1.jpg

$ quilt status
PackageBuilder: bucket/dataset (pre-manifest)

Data:
  train2017/        ->  s3://bucket/data/dataset/v0/train2017/
  train2017/1.jpg   -> ./replacement/1.jpg
  val2017/          ->  s3://bucket/data/dataset/v0/val2017/
  test2017/         -> ../test2017/

$ quilt push-manifest -t v0
Error: Manifest contains pointers to local files. Use push-data to first push those files to s3 or --force-allow-local-files if this is intentional

$ quilt push-data --prefix=data/dataset/v0/
Copying s3://bucket/data/dataset/v0/train2017/ to s3://bucket/data/dataset/v0/train2017/... (data exists, skipping)
Pushing ./replacement/1.jpg to s3://bucket/data/dataset/v0/train2017/1.jpg
Copying s3://bucket/data/dataset/v0/val2017/ to s3://bucket/data/dataset/v0/val2017/... (data exists, skipping)
Pushing ../test2017/ to  s3://bucket/data/dataset/v0/test2017/...

$ quilt push-manifest
Building manifest...
Tophash: 3e6e97cccc554c210a5e6eb70f77367fd05abfd4c4da5847f97fa13439e62448

Pushing manifest to s3://bucket/.quilt/PACKAGE=dataset/HASH_PREFIX=3e/3e6e97cccc554c210a5e6eb70f77367fd05abfd4c4da5847f97fa13439e62448.jsonl

$ quilt status
Package: bucket/dataset@3e6e97ccc
Data matches manifest
```


## Posing as a PyTorch Dataset

```
from quilt3 import Package

class MyCustomDataset:
  def __init__(self, quilt_package_name, tag=None, hash=None):
    self.pkg = Package(quilt_package_name, tag=tag, hash=hash)
    # does this require the entire manifest?
    # we should probably show an example filtering on metadata instead of
    # keys as strings
    self.img_entries = [entry for entry in self.pkg 
                        if entry.logical_key.startswith("train/")]

    # what does get_entry do, get the file bytes?
    self.annotations = self.pkg.get_entry("annotations/train.json")
    
  def __len__(self):
    return len(self.img_entries)

  def __getitem__(self, idx):
    entry = self.img_entries[idx]
    
    # In existing codebases, annotations are often stored in a single file
    # I don't follow this; you are after a folder?
    img_id = [img for img in self.annotations["images"] 
              if img["path"] == entry.logical_key.lstrip("train/")]
              
    assert len(img_id) == 1
    img_id = img_id[0]["image_id"]
    
    img_annotations = [ann for ann in self.annotations["annotations"] 
                       if ann["image_id"] == image_id]
                       
    # With Quilt Packages, each entry has metadata associated with it, which 
    # can be used to simplify the above code
    img_annotations = entry.metadata["annotations"]

    
    return {
      "image": entry.get_bytes(),  # Quilt takes care of the caching so you don't need to think about it.
      "annotations": img_annotations
    }
```