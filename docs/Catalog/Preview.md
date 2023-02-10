<!-- markdownlint-disable -->

The Quilt catalog renders previews of the following file types.
Whenever possible, Quilt streams the smallest possible subset of the data
needed to generate the preview.

Previews are supported for uncompressed files as well as for gzip archives (.gz).

## Plain text previews
Quilt can display any plaintext file format, including the following. 

* Most programming languages, with syntax highlighting
(.cpp, .json, .js, .py, .sh,  .sql, etc.)
* Biological file formats (.bed, .cef, .gff, .fasta, .fastq, .sam, .pdbqt, .vcf, etc.)
* Text files (.csv, .md, .readme, .tsv, .txt, etc.)

## Chemical structures
The Quilt catalog uses the [NGL Viewer library](https://github.com/nglviewer/ngl) to render structures.
By default, v3000 Molfiles are converted to v2000 by the JavaScript client for rendering.

The following file formats are supported:
* Mol files (.mol, .mol2, .sdf)
* .cif
* .ent
* .pdb

## Binary and special file format previews
* Excel (.xls, .xlsx)
* FCS Flow Cytometry files (.fcs)
* Images (.gif, .jpg, .png, .tif, .tiff, etc.)
* Media (.mp4, .webm, .flac, .m2t, .mp3, .mp4, .ogg, .ts, .tsa, .tsv, .wav)
* .ipynb (Jupyter and Voila dashboards)
* .parquet

## Advanced

You can use visualizations inside iframes using any libraries you want.
It's up to you what JS library you'll import and use.

To enable this permissive visualizations, you can tick the "Enable permissive HTML rendering" checkbox in [Bucket settings](/catalog/admin#buckets). Keep in mind, that the process of rendering HTML file creates a short living session, that allows sharing files of the packages publicly.

So, when you open `report.html`, a new session is created, and we render `/short-living-session-id/report.html` in iframe. This let us fetch all relative media and scripts in that page: `./img.jpg` becomes `/short-living-session-id/img.jpg`, `script.js` becomes `/short-living-session-id/script.js`, etc. But, also makes other files in the same package available by those paths `/short-living-session-id/was-not-shared-explicitly.txt`, even if not referenced in `report.html`.
