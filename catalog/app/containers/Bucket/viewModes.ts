import * as R from 'ramda'
import * as React from 'react'

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

const VOILA_MODE = { key: 'voila', label: 'Voila' }

export default function useViewModes(registryUrl: string, path: string): ViewMode[] {
  const [viewModes, setViewModes] = React.useState<ViewMode[]>([])

  React.useEffect(() => {
    async function fillViewModes() {
      const isNotebook = path.endsWith('.ipynb')
      if (isNotebook) {
        setViewModes(R.concat([JUPYTER_MODE, JSON_MODE]))
        const isVoilaSupported = await pingVoilaService(registryUrl)
        if (isVoilaSupported) {
          setViewModes(R.append(VOILA_MODE))
        } else {
          // eslint-disable-next-line no-console
          console.debug('Voila is not supported by current stack')
          // TODO: add link to documentation
        }
      }
    }
    fillViewModes()
  }, [path, registryUrl])

  return viewModes
}
