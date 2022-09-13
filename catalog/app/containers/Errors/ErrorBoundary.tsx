import * as React from 'react'
import { useLocation } from 'react-router-dom'

import Error from 'components/Error'
import Layout from 'components/Layout'
import { createBoundary } from 'utils/ErrorBoundary'
import * as Sentry from 'utils/Sentry'

interface ErrorBoundaryPlaceholderProps {
  error: Error
  info: any
  reset: () => void
}

function ErrorBoundaryPlaceholder({ error, info, reset }: ErrorBoundaryPlaceholderProps) {
  const location = useLocation()
  const errorShown = React.useRef(false)
  React.useEffect(() => {
    if (!errorShown.current) {
      errorShown.current = true
      return
    }
    errorShown.current = false
    reset()
  }, [location.pathname, reset])

  const sentry = Sentry.use()
  React.useEffect(() => {
    sentry('captureException', error, info)
  }, [error, info, sentry])

  return (
    <Layout bare>
      <Error headline="Unexpected Error" detail="Something went wrong" />
    </Layout>
  )
}

const ErrorBoundary = createBoundary(
  (_: unknown, { reset }: { reset: () => void }) =>
    (error: $TSFixMe, info: $TSFixMe) =>
      <ErrorBoundaryPlaceholder error={error} info={info} reset={reset} />,
)

export default ErrorBoundary
