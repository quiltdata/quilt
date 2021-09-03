import { extname } from 'path'
import * as React from 'react'

// NOTE: module imported selectively because Preview's deps break unit-tests
import { PreviewData } from 'components/Preview/types'
import AsyncResult from 'utils/AsyncResult'
import { useVoila } from 'utils/voila'

const MODES = {
  json: 'JSON',
  jupyter: 'Jupyter',
  vega: 'Vega',
  voila: 'Voila',
}

export type ViewMode = keyof typeof MODES

const isVegaSchema = (schema: string) => {
  if (!schema) return false
  return !!schema.match(/https:\/\/vega\.github\.io\/schema\/([\w-]+)\/([\w.-]+)\.json/)
}

export const viewModeToSelectOption = (m: ViewMode | null) =>
  m && {
    toString: () => MODES[m],
    valueOf: () => m,
  }

export function useViewModes(path: string, modeInput: string) {
  const voilaAvailable = useVoila()
  const [previewResult, setPreviewResult] = React.useState(null)

  const handlePreviewResult = React.useCallback(
    (result) => {
      if (!previewResult && AsyncResult.Ok.is(result)) {
        setPreviewResult(AsyncResult.Ok.unbox(result))
      }
    },
    [previewResult, setPreviewResult],
  )

  const modes: ViewMode[] = React.useMemo(() => {
    switch (extname(path)) {
      case '.ipynb':
        return voilaAvailable ? ['jupyter', 'json', 'voila'] : ['jupyter', 'json']
      case '.json':
        return PreviewData.case(
          {
            Vega: (json: any) =>
              isVegaSchema(json.spec?.$schema) ? ['vega', 'json'] : [],
            Json: (json: any) =>
              isVegaSchema(json.rendered?.$schema) ? ['vega', 'json'] : [],
            _: () => [],
            __: () => [],
          },
          previewResult,
        )
      default:
        return []
    }
  }, [path, previewResult, voilaAvailable])

  const mode = (
    modes.includes(modeInput as any) ? modeInput : modes[0] || null
  ) as ViewMode | null

  return { modes, mode, handlePreviewResult }
}
