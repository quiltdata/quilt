import * as React from 'react'

// NOTE: module imported selectively because Preview's deps break unit-tests
import { PreviewData } from 'components/Preview/types'
import type { ValueBase as SelectOption } from 'components/SelectDropdown'
import AsyncResult from 'utils/AsyncResult'

const MODES = {
  echarts: 'ECharts',
  igv: 'IGV',
  json: 'JSON',
  jupyter: 'Jupyter',
  txt: 'Plain Text',
  vega: 'Vega',
  voila: 'Voila',
}

export type ViewMode = keyof typeof MODES

export function viewModeToSelectOption(m: ViewMode): SelectOption
export function viewModeToSelectOption(m: null): null
export function viewModeToSelectOption(m: ViewMode | null): SelectOption | null {
  return (
    m && {
      toString: () => MODES[m],
      valueOf: () => m,
    }
  )
}

export function useViewModes(modeInput: string | null | undefined) {
  const [previewResult, setPreviewResult] = React.useState(null)

  const handlePreviewResult = React.useCallback(
    (result) => {
      if (!previewResult && AsyncResult.Ok.is(result)) {
        setPreviewResult(AsyncResult.Ok.unbox(result))
      }
    },
    [previewResult, setPreviewResult],
  )

  const viewModes: ViewMode[] = React.useMemo(
    () =>
      PreviewData.case(
        {
          _: ({ value }: $TSFixMe) => value.modes || [],
          __: () => [],
        },
        previewResult,
      ),
    [previewResult],
  )

  const mode = (
    viewModes.includes(modeInput as any) ? modeInput : viewModes[0] || null
  ) as ViewMode | null

  return { modes: viewModes, mode, handlePreviewResult }
}
