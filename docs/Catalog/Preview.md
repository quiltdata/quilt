<!-- markdownlint-disable-next-line first-line-h1 -->
The Quilt catalog renders previews of the following file types.
Whenever possible, Quilt streams the smallest possible subset of the data
needed to generate the preview.

Previews are supported for uncompressed files as well as for gzip archives (.gz).

## Plain text previews

Quilt can display any plaintext file format, including the following.

* Most programming languages, with syntax highlighting
  (.cpp, .json, .js, .py, .sh,  .sql, etc.)
* Biological file formats
  (.bed, .cef, .gff, .fasta, .fastq, .sam, .pdbqt, .vcf, etc.)
* Text files (.csv, .md, .readme, .tsv, .txt, etc.)

## Chemical structures

The Quilt catalog uses the [NGL Viewer library](https://github.com/nglviewer/ngl)
to render structures.
By default, v3000 Molfiles are converted to v2000 by the JavaScript client
for rendering.

The following file formats are supported:

* Mol files (.mol, .mol2, .sdf)
* .cif
* .ent
* .pdb

## Image previews

The Quilt Catalog uses a [Lambda
function](https://github.com/quiltdata/quilt/tree/master/lambdas/thumbnail)
to automatically generate thumbnail previews of common image formats
and select microscopy image formats such as .bmp, .gif, .jpg, .jpeg,
.png, .webp, .tif, .tiff (including `OME-TIFF`), and .czi.

### Known limitations

Automated previews of 8-bit depth and higher image files are not
currently supported.

## Binary and special file format previews

* FCS Flow Cytometry files (.fcs)
* Media (.mp4, .webm, .flac, .m2t, .mp3, .mp4, .ogg, .ts, .tsa, .tsv, .wav)
* Jupyter notebooks (.ipynb)
* .parquet
* PDF (.pdf)
* PowerPoint (.pptx)
* Excel (.xls, .xlsx)

## Advanced: HTML rendering and Quilt Package File Server

The Quilt Catalog supports HTML and JavaScript in preview via iframes. By default,
preview iframes do not have IAM permissions and are therefore unable to access
private files in S3.

If you wish for your HTML to access data within the enclosing package or bucket
(at the viewer's level of permissions) and/or use origin-aware Web APIs
such as data storage/cookies, you must opt in to
`Enable permissive HTML rendering` in [Bucket settings](Admin.md#buckets).

> You should _only enable this feature for buckets where you implicitly
> trust_ the contents of the HTML files.

Depending on the context where the HTML file is rendered (package vs bucket view),
the iframe gets the following origin:

* Inside a package view with permissive rendering **enabled**:
  the origin is the **Quilt Package File Server**.

* Inside a bucket view with permissive rendering **enabled**:
  the origin is the AWS S3 bucket endpoint.

* With permissive rendering **disabled** (irrespective of package or bucket view):
  the resource is treated as being from a special origin that always fails the
  same-origin policy
  ([`allow-same-origin` iframe sandbox token](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe#sandbox)
  is not set).

> An important implication of same-origin policy is that the scripts
> executed under the same origin share LocalStorage data and cookies.

### Package view example with permissive rendering enabled

1. `report.html` is a file in a package that includes a publicly available JS
   library and a custom embedded script.
2. Opening `report.html` in a package view generates a new session `temporary-session-id`.
3. The file is served by the **Quilt Package File Server** under the
   `/temporary-session-id/report.html` path.
4. All relative media and scripts are rendered in the same iframe relative-path
   format:
    * `./img.jpg` is resolved to `/temporary-session-id/img.jpg`
    * `script.js` is resolved to `/temporary-session-id/script.js`
5. The `allow-same-origin` iframe sandbox token is enabled,
   the origin is the **Quilt Package File Server**,
   the LocalStorage API is **available**.

### Bucket view example with permissive rendering enabled

1. `report.html` is a file in a bucket `example-bucket` that includes a publicly
   available JS library and custom embedded script.
2. When opening `report.html` in bucket view, it is served directly by S3
   via a signed HTTPS URL, e.g.
   `https://example-bucket.s3.region.amazonaws.com/report.html?versionId=...&X-Amz-...`.
3. All relative media and scripts are rendered in the same iframe relative-path
   format:
    * `./img.jpg` is resolved to `/img.jpg`
    * `script.js` is resolved to `/script.js`
4. The `allow-same-origin` iframe sandbox token is **enabled**,
   the origin is the **S3 bucket endpoint**
   (e.g. `https://example-bucket.s3.region.amazonaws.com`),
   the LocalStorage API is **available**.

### Example with permissive rendering disabled

1. `report.html` is a file in a bucket `example-bucket` that includes a publicly
   available JS library and custom embedded script.
2. When opening `report.html` in any view it is served directly by S3 via a
   signed HTTPS URL, e.g.
   `https://example-bucket.s3.region.amazonaws.com/report.html?versionId=...&X-Amz-...`.
3. All relative media and scripts are rendered in the same iframe relative-path
   format:
    * `./img.jpg` is resolved to `/img.jpg`
    * `script.js` is resolved to `/script.js`
4. The `allow-same-origin` iframe sandbox token is **disabled**,
   a virtual unique origin is used (always failing the same-origin policy),
   the LocalStorage API is **unavailable**.

### Live packages

* [Dynamic visualizations; interactive IGV dashboard; Perspective datagrids with
images](https://open.quiltdata.com/b/quilt-example/packages/examples/package-file-server)
