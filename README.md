# A package manager for data

Quilt is a data package manager, inspired by the likes of `pip` and `npm`. Just as software package managers provide versioned, reusable building blocks for execution, Quilt provides versioned, reusable building blocks for analysis.

# Motivations

1. **Reproducibility** - Imagine source code without versions. Ouch. Why live with un-versioned data? Versioned data makes analysis reproducible by creating unambiguous references to potentially complex data dependencies.
2. **Less data cleaning** - Finding, cleaning, and organizing data consumes 79% of the average data scientist's time. If data is cleaned _once_ and packaged for posterity, it frees up time for analysis. Quilt further makes it possible to _import_ data and start working immediately. Users can skip data preparation scripts for downloading, cleaning, and parsing data.
3. **Faster analysis** -** **Serialized data loads 5 to 20 times faster than files. Moreover, specialized storage formats like Apache Parquet minimize I/O bottlenecks so that tools like Presto DB and Hive run faster.
4. **Collaboration and transparency **- Data likes to be shared. Quilt offers a centralized data warehouse for finding and sharing data sets.

# Demo
<iframe width="560" height="315" src="https://www.youtube.com/embed/tLdiDqtnnho" frameborder="0" allowfullscreen></iframe>

# Learn more
* [Manage data like code](https://blog.quiltdata.com/its-time-to-manage-data-like-source-code-3df04cd312b8)
* [Data packages for fast, reproducible analysis](https://blog.quiltdata.com/data-packages-for-fast-reproducible-python-analysis-c74b78015c7f)



