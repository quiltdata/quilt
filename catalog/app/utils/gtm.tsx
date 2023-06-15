import invariant from 'invariant'
import * as React from 'react'

interface SupportedAttrs {
  async?: boolean
  innerText: string
  src: string
}

function addScript(props: Pick<SupportedAttrs, 'innerText'>): HTMLScriptElement
function addScript(props: Pick<SupportedAttrs, 'async' | 'src'>): HTMLScriptElement
function addScript({ async, innerText, src }: Partial<SupportedAttrs>) {
  const s = window.document.createElement('script')
  s.type = 'text/javascript'

  if (innerText) {
    s.innerText = innerText
  }
  if (async) {
    s.async = async
  }
  if (src) {
    s.src = src
  }
  const x = window.document.getElementsByTagName('script')[0]
  invariant(
    x?.parentNode,
    'No SCRIPT or HEAD element was found, is it the DOM environment?',
  )
  x.parentNode.insertBefore(s, x)
  return s
}

function removeScript(script: HTMLScriptElement) {
  invariant(
    script.parentNode,
    'No SCRIPT or HEAD element was found, is it the DOM environment?',
  )
  script.parentNode.removeChild(script)
}

interface GTMLoaderProps {
  children: React.ReactNode
  gtmId: string
}

export default function GTMLoader({ children, gtmId }: GTMLoaderProps) {
  React.useEffect(() => {
    if (!gtmId) return
    const gtmMain = addScript({
      async: true,
      src: `https://www.googletagmanager.com/gtag/js?id=${gtmId}`,
    })
    const gtmInit = addScript({
      innerText: `
        window.dataLayer = window.dataLayer || [];
        function gtag(){dataLayer.push(arguments);}
        gtag('js', new Date());
        gtag('config', '${gtmId}');
      `.replace(/\n/g, ' '),
    })
    return () => {
      removeScript(gtmMain)
      removeScript(gtmInit)
    }
  }, [gtmId])
  return <>{children}</>
}
