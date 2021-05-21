import * as R from 'ramda'
import * as React from 'react'

import * as Config from 'utils/Config'

const VOILA_PING_URL = (registryUrl: string) => `${registryUrl}/voila/`

async function pingVoilaService(registryUrl: string): Promise<boolean> {
  try {
    const result = await window.fetch(VOILA_PING_URL(registryUrl))
    return result.ok
  } catch (error) {
    return false
  }
}

interface ViewMode {
  key: string
  label: string
}

const JSON_MODE = { key: 'json', label: 'JSON' }

const JUPYTER_MODE = { key: 'jupyter', label: 'Jupyter' }

const VOILA_MODE = { key: 'voila', label: 'Voila' }

export default function useViewModes(path: string): ViewMode[] {
  const [viewModes, setViewModes] = React.useState<ViewMode[]>([])

  const { registryUrl } = Config.use()

  React.useEffect(() => {
    async function fillViewModes() {
      const isNotebook = path.endsWith('.ipynb')
      if (isNotebook) {
        setViewModes(R.concat([JSON_MODE, JUPYTER_MODE]))
      }
      const isVoilaSupported = pingVoilaService(registryUrl)
      if (isVoilaSupported) {
        setViewModes(R.append(VOILA_MODE))
      } else {
        // eslint-disable-next-line no-console
        console.debug('Voila is not supported by current stack')
        // TODO: add link to documentation
      }
    }
    fillViewModes()
  }, [path, registryUrl])

  return viewModes
}
