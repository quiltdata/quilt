import * as React from 'react'

interface DelayProps {
  ms?: number
  alwaysRender?: boolean
  children: (ready?: boolean) => JSX.Element
}

export default function Delay({ ms = 1000, alwaysRender = false, children }: DelayProps) {
  const [ready, setReady] = React.useState(false)
  React.useEffect(() => {
    const timeout = setTimeout(() => setReady(true), ms)
    return () => clearTimeout(timeout)
    // run this only once with initial `ms` value, ignore changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // eslint-disable-next-line no-nested-ternary
  return alwaysRender ? children(ready) : ready ? children() : null
}
