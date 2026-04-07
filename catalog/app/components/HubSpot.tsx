import * as React from 'react'

import cfg from 'constants/config'

export default function HubSpot({ children }: { children?: React.ReactNode }) {
  const { hubspotId } = cfg
  React.useEffect(() => {
    if (!hubspotId) return undefined
    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.id = 'hs-script-loader'
    script.async = true
    script.defer = true
    script.src = `//js.hs-scripts.com/${hubspotId}.js`
    document.head.appendChild(script)
    return () => {
      script.remove()
    }
  }, [hubspotId])
  return <>{children}</>
}
