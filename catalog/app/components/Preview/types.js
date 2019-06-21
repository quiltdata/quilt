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
*/

export const PreviewData = tagged([
  'DataFrame', // { preview: string }
  'Image', // { handle: object }
  'IFrame', // { src: string }
  'Markdown', // { rendered: string }
  'Notebook', // { preview: string }
  'Parquet', // { preview: string, ...ParquetMeta }
  'Text', // { contents: string, lang: string }
  'Vcf', // { meta: string[], header: string[], body: string[][], variants: string[] }
  'Vega', // { spec: Object }
])

export const PreviewError = tagged([
  'TooLarge', // { handle }
  'Unsupported', // { handle }
  'DoesNotExist', // { handle }
  'Unexpected', // { handle, originalError: any }
  'MalformedJson', // { handle, originalError: SyntaxError }
])
