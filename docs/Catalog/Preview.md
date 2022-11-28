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

### ⚠ Warning: Previewing multiple molecules from a single .sdf file

Currently, the Quilt catalog does not support visualization of
multiple molecules with titles from a single .sdf file.

## Binary and special file format previews
* Excel (.xls, .xlsx)
* FCS Flow Cytometry files (.fcs)
* Images (.gif, .jpg, .png, .tif, .tiff, etc.)
* Media (.mp4, .webm, .flac, .m2t, .mp3, .mp4, .ogg, .ts, .tsa, .tsv, .wav)
* .ipynb (Jupyter and Voila dashboards)
* .parquet

## Advanced

You can use visualizations inside iframes.

To retrieve data from you can use simple `quilt` JS API:

```
quilt.onReady: (env) => void` // when iframe's quilt API is ready, env argument in callback is `{ fileHandle, packageHandle }`
quilt.listFiles: () => Promise<{ bucket: string, key: string }[]> // returns list of files in current directory
quilt.findFile: ({ key: string }) => Promise<Response> // returns window Fetch API response with content of file
quilt.fetchFile: ({ key: string }) => Promise<Response> // returns window Fetch API response with content of file
```

Example:
```tsx
<html>
  <script "http://download-perspective-from-cdn.js"></script>

  <perspective-viewer></perspective-viewer>

  <script>
    async function initDashboard() {
      const response = await quilt.findFile({ key: 'data.json' })
      const data = await response.json()

      const worker = perspective.worker()
      const table = await worker.table(data)
      perspective.load(table)
    }

    quilt.onReady((env) => {
      console.log(env)
      initDashboard()
    })
  </script>
</html>
```
