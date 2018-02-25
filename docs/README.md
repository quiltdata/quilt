# A package manager for data

Quilt is a data package manager, inspired by the likes of `pip` and `npm`. Just as software package managers provide versioned, reusable building blocks for execution, Quilt provides versioned, reusable building blocks for analysis.

## Motivations

1. **Reproducibility** - Imagine source code without versions. Ouch. Why live with un-versioned data? Versioned data makes analysis reproducible by creating unambiguous references to potentially complex data dependencies.
2. **Less data prep** - Quilt abstracts away network, storage, and file format so that users can focus on what they wish to do with the data.
1. **De-duplication** - Data fragments are hashed with `SHA256`. Duplicate data fragments are written to disk once globally per user. As a result, large, repeated data fragments consume less disk and network bandwidth.
3. **Faster analysis** - Serialized data loads 5 to 20 times faster than files. Moreover, specialized storage formats like Apache Parquet minimize I/O bottlenecks so that tools like Presto DB and Hive run faster.
4. **Collaboration and transparency** - Data likes to be shared. Quilt offers a centralized data warehouse for finding and sharing data sets.

## Demo
<iframe width="560" height="315" src="https://www.youtube.com/embed/bKIV1GUVLPc" frameborder="0" allowfullscreen></iframe>
