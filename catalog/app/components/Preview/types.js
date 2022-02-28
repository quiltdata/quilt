import tagged from 'utils/tagged'

/*
ParquetMeta: {
  createdBy: string,
  formatVersion: string,
  numRowGroups: number,
  schema: {
    names: Array(string),
  },
  serializedSize: number,
  shape: { rows: number, columns: number },
}
PreviewStatus: {
  note: string?,
  warnings: string?,
}
*/

export const PreviewData = tagged([
  'Audio', // { src: string }
  'DataFrame', // { preview: string, ...PreviewStatus }
  'ECharts', // { option: object }
  'Fcs', // { preview: string, metadata: object, ...PreviewStatus }
  'IFrame', // { src: string }
  'Image', // { handle: object }
  'Json', // { rendered: object }
  'Markdown', // { rendered: string }
  'Notebook', // { preview: string, ...PreviewStatus }
  'Pdf', // { handle: object, pages: number, firstPageBlob: Blob, type: 'pdf' | 'pptx' }
  'Perspective', // { context: CONTEXT, data: string | ArrayBuffer, handle: S3Handle, meta: ParquetMeta, onLoadMore: () => void, truncated: boolean }
  'Text', // { head: string, tail: string, lang: string, highlighted: { head: string, tail: string }, ...PreviewStatus }
  'Vcf', // { meta: string[], header: string[], body: string[][], variants: string[], ...PreviewStatus }
  'Vega', // { spec: Object }
  'Video', // { src: string }
  'Voila', // { src: string }
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
  'SrcDoesNotExist', // { handle }
  'MalformedJson', // { handle, message }
  'Unexpected', // { handle, retry, originalError: any }
])

export const CONTEXT = {
  FILE: 'file',
  LISTING: 'listing',
}
