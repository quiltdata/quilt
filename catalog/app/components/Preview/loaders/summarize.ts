import type * as Summarize from 'containers/Bucket/requests/summarize'

export * from 'containers/Bucket/requests/summarize'

export function detect(fileType: Summarize.TypeShorthand) {
  return (options: Summarize.File): Summarize.Type | undefined =>
    (options as Summarize.FileExtended)?.types?.find(
      (type) => type === fileType || (type as Summarize.TypeExtended).name === fileType,
    )
}
