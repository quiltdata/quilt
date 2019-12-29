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
  'Markdown', // { rendered: string }
  'Notebook', // { preview: string, ...PreviewStatus }
  'Parquet', // { preview: string, ...ParquetMeta, ...PreviewStatus }
  'Text', // { head: string, tail: string, lang: string, highlighted: { head: string, tail: string }, ...PreviewStatus }
  'Vcf', // { meta: string[], header: string[], body: string[][], variants: string[], ...PreviewStatus }
  'Vega', // { spec: Object }
])

export const PreviewError = tagged([
  'TooLarge', // { handle }
  'Unsupported', // { handle }
  'DoesNotExist', // { handle }
  'Unexpected', // { handle, originalError: any }
  'MalformedJson', // { handle, originalError: SyntaxError }
])
