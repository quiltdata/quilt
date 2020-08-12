/* embed-debug-harness.js - debug tool for embedded browser */
import * as React from 'react'
import ReactDOM from 'react-dom'
import 'sanitize.css' // side-effect: inject global css

import { createBoundary } from 'utils/ErrorBoundary'

const ErrorBoundary = createBoundary(() => (/* error, info */) => (
  <h1
    style={{
      alignItems: 'center',
      color: '#fff',
      display: 'flex',
      height: '90vh',
      justifyContent: 'center',
      maxHeight: '600px',
    }}
  >
    Something went wrong
  </h1>
))

function Embedder() {
  const iframeRef = React.useRef(null)

  const postMessage = React.useCallback((msg) => {
    if (!iframeRef.current) return
    const w = iframeRef.current.contentWindow
    console.log('posting msg', msg)
    // TODO: use origin?
    w.postMessage(msg)
  }, [])

  const postInit = React.useCallback(() => {
    postMessage({
      type: 'init',
      bucket: 'allencell',
      path: '',
    })
  }, [postMessage])

  //const handleMessage = React.useCallback((msg) => {
    ////console.log('msg received', msg, arguments)
  //}, [])

  //React.useEffect(() => {
    //window.addEventListener('message', handleMessage)
    //return () => {
      //window.removeEventListener('message', handleMessage)
    //}
  //}, [handleMessage])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ marginTop: '2rem', marginBottom: '2rem' }}>
        <button onClick={postInit}>init</button>
      </div>
      <iframe src="/__embed" width="900" height="600" ref={iframeRef} />
    </div>
  )
}

ReactDOM.render(
  <ErrorBoundary><Embedder /></ErrorBoundary>,
  document.getElementById('app'),
)
