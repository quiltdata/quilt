<!-- markdownlint-disable-next-line first-line-h1 -->
Every package and object in Packages view has a "CODE" pane, which contains:

- **Python**: code snippet to install (and update) the package or object
- **CLI**: shell commands to install (and update) the package or object
- **URI**: a Quilt+ URI to uniquely identify the package or object

## Quilt+ URIs

Quilt+ URIs are a way to uniquely identify a package or object in the Quilt
catalog. They are used to reference packages and objects relative to a Quilt
bucket.  For example:

<!-- markdownlint-disable-next-line line-length -->
`quilt+s3://quilt-example#package=akarve/cord19@e21682f00929661879633a5128aaa27cc7bc1e2973d49d4c868a90f9fad9f34b&path=CORD19.ipynb`

The URI above references a specific version of the `CORD19.ipynb` notebook in
the `akarve/cord19` package of the `quilt-example` bucket.

### Syntax

A Quilt+ URI most contain the following components:

- `quilt+`: The scheme of the URI. This is always `quilt+`.
- `s3://`: The protocol of the URI. This is currently `s3://`.
- `<bucket>`: The name of the bucket containing the package or object, e.g.
  `quilt-example`.
- `#`: The fragment delimiter between the bucket and the package or object
  reference.
- `package=<package>`: The name of the package containing the object, e.g.
  `akarve/cord19`.

In addition, it may contain the following optional components:

- `<package>@<top_hash>`: The hash for this specific package, e.g.
  `e21682f00929661879633a5128aaa27cc7bc1e2973d49d4c868a90f9fad9f34b`.
- `<package>:tag`: The tag for this specific package. Currently, only the
  `latest` tag is supported.  You may not specify both a top_hash and a tag.
- `&path=<path>`: The path to the object within the package, if any, e.g.
  `CORD19.ipynb`.
