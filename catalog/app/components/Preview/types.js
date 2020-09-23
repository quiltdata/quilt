import tagged from 'utils/tagged'

/*
ParquetMeta: {
  createdBy: string,
  formatVersion: string,
  metadata: object,
  numRowGroups: number,
  schema: Array({
    path: string,
    logicalType: string,
    physicalType: string,
    maxDefinitionLevel: string,
    maxRepetitionLevel: string,
  }),
  serializedSize: number,
  shape: { rows: number, columns: number },
}

PreviewStatus: {
  note: string?,
  warnings: string?,
}
*/

export const PreviewData = tagged([
  'DataFrame', // { preview: string, ...PreviewStatus }
  'Image', // { handle: object }
  'IFrame', // { src: string }
  'Fcs', // { preview: string, metadata: object, ...PreviewStatus }
  'Markdown', // { rendered: string }
  'Notebook', // { preview: string, ...PreviewStatus }
  'Parquet', // { preview: string, ...ParquetMeta, ...PreviewStatus }
  'Pdf', // { handle: object, pages: number, firstPageBlob: Blob }
  'Text', // { head: string, tail: string, lang: string, highlighted: { head: string, tail: string }, ...PreviewStatus }
  'Vcf', // { meta: string[], header: string[], body: string[][], variants: string[], ...PreviewStatus }
  'Vega', // { spec: Object }
])

export const PreviewError = tagged([
  'Deleted', // { handle }
  'Archived', // { handle }
  'InvalidVersion', // { handle }
  'Forbidden', // { handle }
  'Gated', // { handle, load }
  'TooLarge', // { handle }
  'Unsupported', // { handle }
  'DoesNotExist', // { handle }
  'MalformedJson', // { handle, message }
  'Unexpected', // { handle, retry, originalError: any }
])
