import * as React from 'react'

export default function Delay({ ms = 1000, alwaysRender = false, children }) {
  const [ready, setReady] = React.useState(false)
  React.useEffect(() => {
    const timeout = setTimeout(() => setReady(true), ms)
    return () => clearTimeout(timeout)
  }, [])
  // eslint-disable-next-line no-nested-ternary
  return alwaysRender ? children(ready) : ready ? children() : null
}
