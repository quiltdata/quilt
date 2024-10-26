<!-- markdownlint-disable-next-line first-line-h1 -->
Every package and object in the Bucket and Packages views has a "CODE" pane,
which contains code snippets that can be used to download and upload a package
or object via either:

- Python (API) ![Python](../imgs/uri-python.png)
- CLI (shell commands) ![CLI](../imgs/uri-cli.png)

In addition, Packages have a third tab that returns a Quilt+ URI:

- URI (identifier) ![URI](../imgs/uri-uri.png)

They all have a `copy` button that copies the code to the clipboard.

## Quilt+ URIs

Quilt+ URIs are a way to uniquely identify a package or object in the Quilt
catalog. They are used to reference packages and objects relative to a Quilt
bucket.  For example:

<!-- markdownlint-disable-next-line line-length -->
`quilt+s3://quilt-example#package=akarve/cord19@e21682f00929661879633a5128aaa27cc7bc1e2973d49d4c868a90f9fad9f34b&path=CORD19.ipynb&catalog=open.quiltdata.com`

The URI above references a specific version of the `CORD19.ipynb` notebook in
the `akarve/cord19` package of the `quilt-example` bucket.

### Catalog Usage

URIs can be used to quickly navigate to a specific package or object from the
Catalog.  If your window is wide enough, there will be a "URI" button to the
right of the search bar.  Clicking this button will display a dialog where you
can paste a URI and "Resolve" it to navigate to the package or object it
references.

![Resolving URIs](../imgs/uri-resolve.png)

### Syntax

A Quilt+ URI most contain the following components:

- `quilt+`: The scheme of the URI. This is always `quilt+`.
- `s3://`: The protocol of the URI. This is currently `s3://`.
- `<bucket>`: The name of the bucket containing the package or object, e.g.
  `quilt-example`.
- `#package=<package>`: A fragment for the name of the package containing the
  object, e.g. `akarve/cord19`.

In addition, it may contain the following optional components:

- `<package>@<top_hash>`: The hash for this specific package, e.g.
  `e21682f00929661879633a5128aaa27cc7bc1e2973d49d4c868a90f9fad9f34b`.
- `<package>:tag`: The tag for this specific package. Currently, only the
  `latest` tag is supported.  You may not specify both a top_hash and a tag.
- `&path=<path>`: Fragment for the path to the object within the package, if
  any, e.g.ß `CORD19.ipynb`.
- `&catalog=<catalog>`: Fragment for the DNS name of catalog where this package
  was located.

Note that a given bucket may be available from zero or more catalogs,
each of which may support different users and access controls.
