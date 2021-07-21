import { extname } from 'path'
import * as R from 'ramda'
import * as React from 'react'

// NOTE: module imported selectively because Preview's deps break unit-tests
import { PreviewData } from 'components/Preview/types'
import AsyncResult from 'utils/AsyncResult'
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

export default function useViewModes(
  registryUrl: string,
  path: string,
  previewResult?: $TSFixMe,
): ViewMode[] {
  const [viewModes, setViewModes] = React.useState<ViewMode[]>([])

  const handleNotebook = React.useCallback(async () => {
    setViewModes([JUPYTER_MODE, JSON_MODE])
    const isVoilaSupported = await pingVoilaService(registryUrl)
    if (isVoilaSupported) {
      setViewModes(R.append(VOILA_MODE))
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
        Ok: (jsonResult: $TSFixMe) => {
          PreviewData.case(
            {
              Vega: (json: any) => {
                if (isVegaSchema(json.spec?.$schema)) {
                  setViewModes([VEGA_MODE, JSON_MODE])
                }
              },
              Json: (json: any) => {
                if (isVegaSchema(json.rendered?.$schema)) {
                  setViewModes([VEGA_MODE, JSON_MODE])
                }
              },
              _: () => null,
            },
            jsonResult,
          )
        },
        _: () => null,
      },
      previewResult,
    )
  }, [previewResult])

  React.useEffect(() => {
    async function fillViewModes() {
      const ext = extname(path)
      switch (ext) {
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
    }
    fillViewModes()
  }, [handleJson, handleNotebook, path, registryUrl])

  return viewModes
}
