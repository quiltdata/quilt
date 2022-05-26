
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

## Chemical files
We use NGL library to render chemical files. It doesn't render v3000 Mol file format, so we convert it to v2000

It's a work in progress, preview for .mol files is better developed

* Mol files (.mol, .mol2, .sdf)
* Other chemical files (.cif, .ent, .pdb)

## Binary and special file format previews
* Excel (.xls, .xlsx)
* FCS Flow Cytometry files (.fcs)
* Images (.gif, .jpg, .png, .tif, .tiff, etc.)
* Media (.mp4, .webm, .flac, .m2t, .mp3, .mp4, .ogg, .ts, .tsa, .tsv, .wav)
* .ipynb (Jupyter and Voila dashboards)
* .parquet
