import * as React from 'react'

// NOTE: module imported selectively because Preview's deps break unit-tests
import Modes from 'components/Preview/loaders/modes'
import { PreviewData } from 'components/Preview/types'
import type { ValueBase as SelectOption } from 'components/SelectDropdown'
import AsyncResult from 'utils/AsyncResult'

const MODES = {
  [Modes.Echarts]: 'ECharts',
  [Modes.Html]: 'HTML',
  [Modes.Igv]: 'IGV',
  [Modes.Json]: 'JSON',
  [Modes.Jupyter]: 'Jupyter',
  [Modes.Markdown]: 'Markdown',
  [Modes.Ngl]: 'NGL',
  [Modes.Tabular]: 'Tabular Data',
  [Modes.Text]: 'Plain Text',
  [Modes.Vega]: 'Vega',
  [Modes.Voila]: 'Voila',
}

// FIXME: Dont create this type, use modes
export type ViewMode = Modes

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

export function useViewModes(modeInput: string | null | undefined): {
  modes: ViewMode[]
  mode: ViewMode | null
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

  const viewModes: ViewMode[] = React.useMemo(
    () =>
      PreviewData.case(
        {
          _: ({ value }: { value: { modes?: ViewMode[] } }) => value?.modes || [],
          __: () => [],
        },
        previewResult,
      ),
    [previewResult],
  )

  const mode: ViewMode | null = (
    viewModes.includes(modeInput as ViewMode)
      ? (modeInput as ViewMode)
      : viewModes[0] || null
  ) as ViewMode | null

  return { modes: viewModes, mode, handlePreviewResult }
}
