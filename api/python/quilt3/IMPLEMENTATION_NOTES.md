# Notes on `package.set('KEY', df)`

Looked into how to set up a PackageEntry from an in-memory object



I see 3 main options

1. We serialized the data frame to disk on Package.set. (serialize on set)
    1. This has performance implications for the set operation. My tests showed a rate of 3MB/sec for a pd.DataFrame -> CSV
    2. This is the least complicated solution - we do not have to further complicate what a Package is because all entries will be standard PackageEntries
    3. Hashing can be deferred like any other PackageEntry to speed up Package.set(), but raw serialization is still relatively slow
    4. The only hard problem other than performance is managing the intermediate files/quilt cache, but this is not too hard of a problem
    5. This is my preferred short-term solution if we can say if we are trying to address a specific user’s needs that is small enough to be performant
2. We defer serialization until Package.push() (serialize on push)
    1. This is good in that the slow serialization and hashing operations occur during an operation the user already expects to be slow
    2. This significantly complicates the codebase as now a Package is made up of both PackageEntries and LazySerializedPackageEntries. 
    3. Has a real risk of breaking user code as PackageEntry is a public API surface that user may be depending on
    4. Requires quite a lot of new code and refactoring (i.e. copy_file_list needs to also handle serialization to disk and hash generation)
    5. I don’t feel confident that I know all the places that this may break
3. We significantly refactor the entire Package codebase
    1. Differentiate between Package (an immutable structure with physical keys that point to the final location and has hashes generated) and ProposedPackage (a mutable datastructure used to build a new package)
    2. This refactor would allow us to distinguish between the user-facing API that can be relied on and the internal API that we can rapidly change to improve performance.
    3. This may also help us with our performance optimizations
    4. The mental model of a ‘Package’ is substantially simplified and I think it would have positive ripple effects on our codebase (no more uncertainty about whether the hash exists, etc)
    5. I am not confident that I understand all of the implications of this refactor



### Serialize on set
Looked into serializing and writing on set. A 283Mb dataframe took 101 seconds to write to disk on my machine. Not an acceptable option.

### Serialize on push

Between `package.set` and `package.push`, `package` will contain both `PackageEntries` and `LazySerializedPackageEntries`. This implementation will require changes to user code as they are fundamentally different (equality won't work, Lazy doesn't have physical keys which user code may rely on)


### Serialize location

Due to potentially large file sizes, I am not considering serializing to memory. Serialized file will be written to disk.