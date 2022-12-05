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

You can use visualizations inside iframes using any libraries you want.
It's up to you what JS library you'll import and use.

To retrieve data you can use simple `quilt` JS API:

```ts
// Callback is fired when quilt's API is ready.
// First argument of a callback  is an object containing context data.
interface Env {
  fileHandle: { bucket: string, key: string, version?: string },
  packageHandle: { bucket: string, name: string, hash: string },

}
quilt.onReady: (env: Env) => void

// Lists sibling files in the same directory as iframe.
// Returns array of `{ bucket: stirng, key: string }`.
quilt.listFiles: () => Promise<{ bucket: string, key: string }[]>

// Returns contents of the file (JSON, ArrayBuffer or text)
// or in rare edge cases window Fetch API response.
quilt.fetchFile: ({ bucket: string, key: string }) => Promise<JSON | Arraybuffer | string | Response>

// Almost the same as `fetchFile`, but `bucket` is optional, and key can be partial.
// This is slower because technicaly we need to list first then find that file.
quilt.findFile: ({ key: string }) => Promise<JSON | Arraybuffer | string | Response>
```

There are helper functions for importing JS libraries:

```ts
// Lists available libraries names
// Some libraries or namespacess have dependencies
quilt.scripts.list: () => (string, [string, string[]])[]

// Imports library
interface ImportedLibrary {
  libraryName: string
  version: string
  path?: string
}
quilt.scripts.install: (name: string, version?: string) => Promise<ImportedLibrary[]>
```

Example:
```tsx
<html>
<head>
  <script src="http://download-perspective-from-cdn.js"></script>
</head>

<body>
  <perspective-workspace>
    <perspective-viewer table="tableA"></perspective-viewer>
  </perspective-workspace>

  <script>
    async function initDashboard() {
      const worker = perspective.worker();

      const arrayBuffer = await quilt.findFile({
        key: 'data.csv'
      })
      const table = await worker.table(arrayBuffer)
      window.workspace.tables.set('tableA', table)

      const layout = await quilt.fetchFile({
        bucket: 'bucketA',
        key: 'package/name/layout.json'
      })
      window.workspace.restore(layout);
    }

    quilt.onReady(async (env) => {
      const { packageHanlde, fileHandle } = env
      const files = await quilt.listFiles()
      const readme = await quilt.findFile({ key: 'README.md' })
      console.log({
        s3Urls: files.map(({ bucket, key }) => `s3://${bucket}/${key}`),
        iframePath: 'env.fileHandle.key',
        packageName: env.packageHandle.name,
        readme,
      })

      initDashboard()
    })
  </script>
</body>
</html>
```
