import * as React from 'react'

import FileType from 'components/Preview/loaders/fileType'
// NOTE: module imported selectively because Preview's deps break unit-tests
import { PreviewData } from 'components/Preview/types'
import type { ValueBase as SelectOption } from 'components/SelectDropdown'
import AsyncResult from 'utils/AsyncResult'

export type { default as FileType } from 'components/Preview/loaders/fileType'

const FILE_TYPE_TITLES_MAP = {
  [FileType.ECharts]: 'ECharts',
  [FileType.Html]: 'HTML',
  [FileType.Igv]: 'IGV',
  [FileType.Json]: 'JSON',
  [FileType.Jupyter]: 'Jupyter',
  [FileType.Markdown]: 'Markdown',
  [FileType.Ngl]: 'NGL',
  [FileType.Tabular]: 'Tabular Data',
  [FileType.Text]: 'Plain Text',
  [FileType.Vega]: 'Vega',
  [FileType.Voila]: 'Voila',
}

export function viewModeToSelectOption(m: FileType): SelectOption
export function viewModeToSelectOption(m: null): null
export function viewModeToSelectOption(m: FileType | null): SelectOption | null {
  return (
    m && {
      toString: () => FILE_TYPE_TITLES_MAP[m],
      valueOf: () => m,
    }
  )
}

export function useViewModes(modeInput: string | null | undefined): {
  modes: FileType[]
  mode: FileType | null
  handlePreviewResult: (x: any) => any
} {
  const [previewResult, setPreviewResult] = React.useState(null)

  const handlePreviewResult = React.useCallback(
    (result) => {
      if (!previewResult && AsyncResult.Ok.is(result)) {
        setPreviewResult(AsyncResult.Ok.unbox(result))
      }
    },
    [previewResult, setPreviewResult],
  )

  const viewModes: FileType[] = React.useMemo(
    () =>
      PreviewData.case(
        {
          _: ({ value }: { value: { modes?: FileType[] } }) => value?.modes || [],
          __: () => [],
        },
        previewResult,
      ),
    [previewResult],
  )

  const mode: FileType | null = (
    viewModes.includes(modeInput as FileType)
      ? (modeInput as FileType)
      : viewModes[0] || null
  ) as FileType | null

  return { modes: viewModes, mode, handlePreviewResult }
}
