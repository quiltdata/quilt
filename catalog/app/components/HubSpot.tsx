import * as React from 'react'
import * as redux from 'react-redux'
import { useLocation } from 'react-router-dom'

import cfg from 'constants/config'
import * as Auth from 'containers/Auth'
import usePrevious from 'utils/usePrevious'

type HsqCommand =
  | ['setPath', string]
  | ['trackPageView']
  | ['identify', { email: string }]

function hsq(...cmd: HsqCommand[]) {
  // eslint-disable-next-line no-underscore-dangle
  const q = ((window as any)._hsq = (window as any)._hsq || [])
  cmd.forEach((c) => q.push(c))
}

function HubSpotTracker() {
  const location = useLocation()
  const email: string | undefined = redux.useSelector(Auth.selectors.email)
  const path = `${location.pathname}${location.search}`

  React.useEffect(() => {
    const script = document.createElement('script')
    script.type = 'text/javascript'
    script.id = 'hs-script-loader'
    script.async = true
    script.defer = true
    script.src = `https://js.hs-scripts.com/${cfg.hubspotId}.js`
    document.head.appendChild(script)
    return () => {
      script.remove()
    }
  }, [])

  // Track SPA navigations (initial page load is auto-tracked by HubSpot)
  usePrevious(path, (prevPath) => {
    if (prevPath !== undefined && prevPath !== path) {
      hsq(['setPath', path], ['trackPageView'])
    }
  })

  // Identify contact on sign-in
  usePrevious(email, (prevEmail) => {
    if (email && email !== prevEmail) {
      hsq(['identify', { email }], ['trackPageView'])
    }
  })

  return null
}

export default function HubSpot({ children }: { children?: React.ReactNode }) {
  if (!cfg.hubspotId) return <>{children}</>
  return (
    <>
      <HubSpotTracker />
      {children}
    </>
  )
}
