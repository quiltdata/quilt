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

The Quilt catalog uses the [AICSImageIO
library](https://github.com/AllenCellModeling/aicsimageio) to
automatically generate thumbnail previews of multiple
microscopy image file formats. 

> Automated previews of 8-bit depth and higher image files are not
currently supported.

## Binary and special file format previews

* FCS Flow Cytometry files (.fcs)
* Media (.mp4, .webm, .flac, .m2t, .mp3, .mp4, .ogg, .ts, .tsa, .tsv, .wav)
* .ipynb (Jupyter and Voila dashboards)
* .parquet
* PDF (.pdf)
* PowerPoint (.pptx)
* Excel (.xls, .xlsx)

## Advanced: Quilt Package File Server

The Quilt Catalog supports secure, custom Javascript-enabled
visualizations and dashboards embedded inside iframes (Package
File Server). It is at your discretion which JS library (or libraries)
you wish to import in your HTML file.

To enable "permissive" visualizations, check the `Enable permissive HTML
rendering` checkbox in [Bucket settings](Admin.md#buckets). Please note
that rendering Javascript-enabled HTML files in your S3 bucket or Quilt package
creates a short-lived **publicly available** session for the lifetime of the
session, although all session traffic _remains encrypted_.

### Example

1. `report.html` is a file that includes a publicly available JS library and
   custom embedded script.
2. Opening `report.html` generates  a new session `temporary-session-id`.
3. The file is served from the iframe relative-path
   `/temporary-session-id/report.html`.
4. All relative media and scripts are rendered in the same iframe relative-path
   format:
    * `./img.jpg` is served as `/temporary-session-id/img.jpg`
    * `script.js` is served as `/temporary-session-id/script.js`

> **All files in the same package** are made temporarily publicly-available (for
> lifetime of the session) under `/temporary-session-id`, even if not explicitly
referenced in `report.html`.

### Live packages

* [Dynamic visualizations; interactive IGV dashboard; Perspective datagrids with
images](https://open.quiltdata.com/b/quilt-example/packages/examples/package-file-server)
