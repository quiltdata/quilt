# Contributing

## Components

Pull requests generally edit one of the following components at a time.

### [Compiler client](../compiler/)
* Serializes tabular data to Apache Parquet
* Transforms and parses files
* `build`s packages locally
* `push`es packages to the registry
* `pull`s packages from the registry
* Implemented in Python with pandas and PyArrow

Technologies:
* Python
* pandas
* PyArrow

### [Registry](../registry/)
* Manages permissions
* Stores package fragments in blob storage
* Stores package meta-data
* De-duplicates repeated data fragments

Technologies:
* Python
* Flask
* SQLAlchemy
* Postgres

### [Catalog](../catalog/)
* Displays package meta-data in HTML

Technologies:
* JavaScript (ES6+)
* node
* React
* Redux
* Sagas

<img width="640" src="https://raw.githubusercontent.com/quiltdata/resources/master/img/arch.png" />

### TODO
* [ ] Add more detailed diagrams

## [Slack](https://slack.quiltdata.com/)

## [Open Issues](https://github.com/quiltdata/quilt/issues)

## License
Quilt is open source under the [Apache License, Version 2.0.](../LICENSE).

## Code of Conduct
Contributors must adhere to the [Code of Conduct](docs/CODE_OF_CONDUCT.md).
