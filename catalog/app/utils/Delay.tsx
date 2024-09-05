import * as React from 'react'

interface DelayProps {
  ms?: number
  children: React.ReactNode
}

export default function Delay({ ms = 1000, children }: DelayProps) {
  const [ready, setReady] = React.useState(false)
  React.useEffect(() => {
    const timeout = setTimeout(() => setReady(true), ms)
    return () => clearTimeout(timeout)
  }, [ms])
  return <>{ready && children}</>
}
