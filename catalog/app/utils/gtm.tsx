import * as React from 'react'

import cfg from 'constants/config'

function loadScript(src: string) {
  const s = window.document.createElement('script')
  s.type = 'text/javascript'
  s.async = true
  s.src = src

  const x = window.document.getElementsByTagName('script')[0]
  x.parentNode?.insertBefore(s, x)
}

function addScript(content: string) {
  const s = window.document.createElement('script')
  s.type = 'text/javascript'
  s.innerText = content
  const x = window.document.getElementsByTagName('script')[0]
  x.parentNode?.insertBefore(s, x)
}

interface GTMLoaderProps {
  children: React.ReactNode
}

export default function GTMLoader({ children }: GTMLoaderProps) {
  const gtmId = cfg.gtmId
  React.useEffect(() => {
    if (!gtmId) return
    loadScript(`https://www.googletagmanager.com/gtag/js?id=${gtmId}`)
    addScript(`
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${gtmId}');
    `)
  }, [gtmId])
  return <>{children}</>
}
