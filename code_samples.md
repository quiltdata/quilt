# Quilt Package Usecases

## Introduction

This document outlines several key use cases and proposes code samples to satisfy those usecases. Both usecases and code samples are open to discussion.

The document is about UX, not implementation. It does not go much into performance needs, but the expectation is that the implementation will be written such that any API we expose is as high-performance as possible.

API names are rough and will need to be improved.

## Usecase: Download
- I am training a ML model and I want to make a large amount of data accessible to my training model. Currently my code is written to read that data from files in a directory, probably on EFS or FSx. While not an immediate concern to me, I would like to be able to reproduce this model in the future.

>How important is location to this workflow? One motivation for download is that the code expects local files (e.g., in a particular folder). A second motivation is for faster access (especially if files are accessed repeatedly). 
>
>If we can get away without requiring that local files match logical key structures we can keep multiple versions without maintaining extra copies.


```
$ quilt install bucket/dataset:tag
Installing Package bucket/dataset:tag

$ quilt ls
bucket/dataset:tag    18b6a77a6ab31d304f03e01561fbc755b44746b376bcd85e6d226948876470b3

$ runmytraining.sh bucket/dataset:tag
```

### Command Line
```
$ quilt install bucket/dataset:tag --location ./dataset
Installing Package bucket/dataset:tag to ./dataset/...

$ quilt status ./dataset
Package: bucket/dataset:tag (18b6a77a6)
No files have been changed

$ quilt hash ./dataset
18b6a77a6ab31d304f03e01561fbc755b44746b376bcd85e6d226948876470b3
```

### Python
```python
$ pkg = Package("bucket/dataset:tag")
$ pkg.download("./dataset")
$ pkg.verify_directory_matches_manifest("./dataset")
True
$ pkg.hash
18b6a77a6ab31d304f03e01561fbc755b44746b376bcd85e6d226948876470b3
```

```python
$ pkg = Package("bucket/dataset:tag")
$ pkg.install()
$ mymodel.train(pkg)
```

## Usecase: Create and Publish
- I want to move the state of the art forward by giving researchers access to new data. I want it to be easy for researchers to learn about the new data (docs, schema, etc), explore the new data (work with subsets of the data interactively - may or may not be programmatic) and process the new data (run code on large parts/the entire dataset using the scalable tooling of their choice). I cannot anticipate all questions on the data so I want to have a communication channel associated with the dataset for consumers to ask questions. I may wish to improve this dataset in the future by creating a new version. I may or may not (but probably do) care about seeing the state of the art move forward - this may be through a competition (using a standard platform like kaggle, [eval ai](https://evalai.cloudcv.org/), etc) or it may be less formal, such as blog posts or community postings.



### Scripting Python API

Add a directory, build the manifest manually, push the data to s3, push the manifest to s3 (will build the manifest so user doesn't have to do that step by hand).

Force difference between Package and PackageBuilder.

By default enforce best practices, but allow users to explicitly avoid them:
- Don't point to local files
- Don't work with a package if the manifest is not in s3

Metadata on directory is still unclear.

#### Create a PackageBuilder and add a directory
```
> pkg_builder = PackageBuilder("bucket/dataset")
> pkg_builder.add("README.md")
> pkg_builder.add("train2017/")
> pkg_builder
PackageBuilder(
  name: "bucket/dataset",
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
> pkg_builder.build_manifest()
Building manifest...
Tophash: 82111d74b46893c539e816a1119891362049b7a744dd1e188b58751a8ec58b73
> pkg_builder
PackageBuilder(
  name: "bucket/dataset",
  tophash: "82111d74b46893c539e816a1119891362049b7a744dd1e188b58751a8ec58b73",
  manifest: "local"
  contents: [
    "README.md"  -> "./README.md"
    "train2017/" -> "./train2017/..."
  ]
)
```
>When it's possible to reduce the number of core concepts and operations, we'll make life easier for us (as code maintainers) and for our users.
> Here, `build` seems simpler and more concise than `build_manifest`. Build (e.g. in Docker) takes a specification (e.g., a Dockerfile) and produces a core object (e.g., a container image). I could imagine a `PackageBuilder` containing a list of directories, or glob rules or other combinations of ways to choose a set of files. Build would then produce a fully formed package with complete tuples: LK, PK, Hash, Meta.

#### Try to use this PackageBuilder as a Package. Reject unless user explicitly indicates they want to avoid best practices
Another potential exception would be if there is no README file.
```
> pkg = pkg_builder.as_package()
Exception: Manifest contains pointers to local files. Use push_data() to first push those files to s3 or use allow_local_files=True if this is intentional  
Exception: The manifest has not been pushed to a remote repository. Use push_manifest() to first push the manifest to s3 or use allow_local_manifest=True if this is intentional
```

#### Push the local data to s3 and update the pointers. The manifest is still local
```
> pkg_builder.push_data(prefix="/data/dataset/v0/val2017")
Pushing ./train2017/ to s3://bucket/data/dataset/v0/train2017/...
Pushing ./README.md to s3://bucket/data/dataset/v0/README.md

> pkg_builder
PackageBuilder(
  name: "bucket/dataset",
  tophash: "82111d74b46893c539e816a1119891362049b7a744dd1e188b58751a8ec58b73",
  manifest: "local"
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

>I was confused by this example. I would expect a package to be reproducible regardless of whether or not it lives in S3. More precisely, the package should contain enough information to verify that a dataset matches a defined state. The underlying files might no longer be available, but any consumer of the package should be able to verify if the contents match the expected hashes.

#### Push the manifest to s3 - now the user has a Package.
```

> pkg = pkg_builder.push_manifest(tag="v0")
Pushing manifest to s3://bucket/.quilt/PACKAGE=dataset/HASH_PREFIX=82/82111d74b46893c539e816a1119891362049b7a744dd1e188b58751a8ec58b73.jsonl
Linking data/package:v0 to manifest 82111d74b

>>Why do we need a package builder to `push`? If `push` is a core operation of packages, we should be able to push a package without a PackageBuilder. If we can push packages, we shouldn't need push as a method of PackageBuilder.

> pkg
Package(
  name: "bucket/dataset:v0",
  tophash: "82111d74b46893c539e816a1119891362049b7a744dd1e188b58751a8ec58b73",
  manifest: "s3://bucket/.quilt/PACKAGE=dataset/HASH_PREFIX=82/82111d74b46893c539e816a1119891362049b7a744dd1e188b58751a8ec58b73.jsonl",
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




## Usecase: Explore Dataset

- I found a potentially useful dataset and I want to explore it to see if it will be useful. I want to be able read any documentation that is available for the dataset. I want to explore the structure of the dataset (folders, schemas). I want to be able to interactively explore individual pieces of data, for example going through images+labels one-by-one. I want to be able to very quickly determine if this dataset is useless to me - I do not want to have to wait (for example due to downloading the full dataset).

### Interactive Jupyter/Python API
```
> pkg = Package("bucket/dataset")
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

> cats_contents = pkg.ls("cats/")
> cats_contents
cats/file1.txt
cats/tabby/

> file1_contents = pkg.get_contents("cats/file1.txt")
> file1_metadata = pkg.get_metadata("cats/file1.txt")


> files_to_inspect = [entry.logical_key
                      for entry
                      in pkg.ls("cats/")
                      if entry.is_file()]
```

Caching to interactively work with large files.
```
> %time pkg.get("other/huge_file.json")
CPU times: user 123 s, sys: 253 µs, total: 123 s
Wall time: 123 s

> %time pkg.cache("other/huge_file.json")
CPU times: user 123 s, sys: 253 µs, total: 123 s
Wall time: 123 s
_I normally expect caching to transparent_

> %time large_file_contents = pkg.get("other/huge_file.json")
CPU times: user 1 s, sys: 253 µs, total: 1 s
Wall time: 1 s

> pkg.clear_cache()  # We need the user to tell us we can clear the cache
```
>Looks great!

## Usecase: Add new data to dataset
- I have just acquired more data (for example, from a data labelling service) and I want to add that new data to our primary dataset so we can train on it using existing pipelines. Most likely I have acquired a new batch of data, but it is also possible that I am constantly adding new data points one at a time. I want to create a new 'version' of the dataset each time I acquire new data, but I only want to train every X hours/days/weeks. It is important that I am able to rollback my dataset to a previous point in time in case the results of training indicates a problem with the new data.

#### Create a new Package by adding one Package to another
In this example, we assume the new data is stored as a Package
```
> new_data = Package("bucket/new-data:2019-10-30")
> new_data
Package(
  name: "bucket/new-data:2019-10-30",
  tophash: "82111d74b46893c539e816a1119891362049b7a744dd1e188b58751a8ec58b73"
  contents: [
    "new_data/" -> "s3://bucket/data-labelling-service/2019-10-30/..."
  ]
)

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

#### Allow logical key renaming. Fail on collisions by default
```
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

> pkg = pkg_builder.push_manifest(tag="master")
Building manifest...
Tophash: 3e6e97cccc554c210a5e6eb70f77367fd05abfd4c4da5847f97fa13439e62448

Pushing manifest to s3://bucket/.quilt/PACKAGE=dataset/HASH_PREFIX=3e/3e6e97cccc554c210a5e6eb70f77367fd05abfd4c4da5847f97fa13439e62448.jsonl
Linking data/package:master to manifest 3e6e97c
```

#### Incremental Download for Consumers
The user needs to be able to download only the minimum amount of data required to make local files match the new Package. Small updates to large packages should be fast.
```
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

## Usecase: Improve dataset
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

## Usecase: Store Entire Workspace
- I have finished an ML training job and I want to make the results reproducible. I want to save the training outputs along with references to the code+data+environment (git+quilt+docker) that created the model.

#### Python API
```
> PackageBuilder("bucket/temp:2019-10-31").add(".").push_data_and_manifest(prefix="armand/temp/2019-10-31/")
```

#### Command Line API
```
```







## Other usecases
- I want to create a new dataset by sampling for another dataset. This could be to create a representative, smaller dataset for testing. This could also be to bootstrap a training dataset from a publicly available datasets such as OpenImages. I do not want to have to download the entire larger dataset.

- I want to run code that transforms a dataset into a new dataset. For example, this could be taking an image dataset and resizing/extracting crops. This could also be taking a JPEG dataset and creating an equivalent TFRecord dataset. Given the potentially large size of the initial dataset, I will likely want to use some distributed system. I want to be able to use whatever distributed processing framework I currently have a cluster for.

- I want to perform a specific ML task. I have found a high-quality implementation on GitHub. I have labeled data necessary for the task. I want to confirm that I have formatted my data in a way that will work with the implementation - and I do not want to have to actually spend expensive compute to find out by training.







## Command Line code samples that aren't realistic in the near-term

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