# Notes for Refactor

## The Package

A Package is a collection of objects with metadata. The concept of a PackageEntry is very similar to the past except `physical_key` is singular. If there is not a need to distinguish between `system_meta` and `user_meta` we will get rid of it.

One important note: We want the initial metadata download to be as rapid as possible but manifests can easily get into the hundreds of MBs right now. To do this, we may split the manifest into parts - the backbone which is just (logical_key, physical_key, hash) and then metadata which is potentially large. When we create a PackageEntry, we need to account for the fact that we might not have the metadata so PackageEntry.metadata may need to download from s3. 

Undecided: Is package metadata unchanged?

## The Manifest

Logically the manifest is unchanged other than:
- `physical_key` instead of `physical_keys`
- The tophash includes metadata information

However, physically we need to do some magic with the manifest for performance reasons. There will be:
- Full Manifest. The standard JSONL file we are familiar with.
- Fast Manifest. The standard manifest minus metadata. This is all about performance so it may not be JSONL. It should be stored in s3 in a compressed format. If this isn't fast enough, we could further divide it.
- Metadata Chunks. This is a collection of files that allow you to take an entry in the fast manifest and quickly download the associated metadata. This is part of the effort to make exploring a dataset a fast process. In theory this could be one json per entry, in practice we will probably want something more performant. Fast Manifest + Metadata Chunks = Full Manifest. 
- Directory Tree. This is a file that allows for the catalog to rapidly browse the package's file tree. This hasn't been fully fleshed out - maybe we don't need this.

When a Package is pushed, all of these files are written to the s3 bucket. How we will query these with Athena is an unanswered question, but probably just a matter of organizing key names intelligently.

