import { extname } from 'path'
import * as R from 'ramda'
import * as React from 'react'

// NOTE: module imported selectively because Preview's deps break unit-tests
import { PreviewData } from 'components/Preview/types'
import AsyncResult from 'utils/AsyncResult'
import * as Config from 'utils/Config'
import global from 'utils/global'

const VOILA_PING_URL = (registryUrl: string) => `${registryUrl}/voila/`

async function pingVoilaService(registryUrl: string): Promise<boolean> {
  try {
    const result = await global.fetch(VOILA_PING_URL(registryUrl))
    return result.ok
  } catch (error) {
    return false
  }
}

export interface ViewMode {
  key: string
  label: string
}

const JSON_MODE = { key: 'json', label: 'JSON' }

const JUPYTER_MODE = { key: 'jupyter', label: 'Jupyter' }

const VEGA_MODE = { key: 'vega', label: 'Vega' }

const VOILA_MODE = { key: 'voila', label: 'Voila' }

const isVegaSchema = (schema: string) => {
  if (!schema) return false
  return !!schema.match(/https:\/\/vega\.github\.io\/schema\/([\w-]+)\/([\w.-]+)\.json/)
}

const viewModeToSelectOption = (m: ViewMode) => ({
  toString: () => m.label,
  valueOf: () => m.key,
})

export default function useViewModes(path: string, modeKey: string) {
  const { registryUrl } = Config.use()
  const [modes, setMode] = React.useState<ViewMode[]>([])
  const [previewResult, setPreviewResult] = React.useState(false)

  const options = React.useMemo(() => modes.map(viewModeToSelectOption), [modes])

  const mode = React.useMemo(
    () => (modes.length ? modes.find(({ key }) => key === modeKey) || modes[0] : null),
    [modes, modeKey],
  )

  const value = React.useMemo(() => mode && viewModeToSelectOption(mode), [mode])

  const handlePreviewResult = React.useCallback(
    (result) => {
      if (!R.equals(previewResult, result)) setPreviewResult(result)
    },
    [previewResult, setPreviewResult],
  )

  const handleNotebook = React.useCallback(async () => {
    setMode([JUPYTER_MODE, JSON_MODE])
    const isVoilaSupported = await pingVoilaService(registryUrl)
    if (isVoilaSupported) {
      setMode(R.append(VOILA_MODE))
    } else {
      // eslint-disable-next-line no-console
      console.debug('Voila is not supported by current stack')
      // TODO: add link to documentation
    }
  }, [registryUrl])

  const handleJson = React.useCallback(() => {
    if (!previewResult) return

    AsyncResult.case(
      {
        Ok: PreviewData.case({
          Vega: (json: any) => {
            if (isVegaSchema(json.spec?.$schema)) {
              setMode([VEGA_MODE, JSON_MODE])
            }
          },
          Json: (json: any) => {
            if (isVegaSchema(json.rendered?.$schema)) {
              setMode([VEGA_MODE, JSON_MODE])
            }
          },
          _: () => {},
        }),
        _: () => {},
      },
      previewResult,
    )
  }, [previewResult])

  React.useEffect(() => {
    switch (extname(path)) {
      case '.ipynb': {
        handleNotebook()
        break
      }
      case '.json': {
        handleJson()
        break
      }
      // no default
    }
  }, [handleJson, handleNotebook, path, registryUrl])

  return { options, value, mode, handlePreviewResult }
}
