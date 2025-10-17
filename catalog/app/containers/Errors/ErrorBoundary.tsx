import * as React from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { useLocation } from 'react-router-dom'
import * as Sentry from '@sentry/react'

import Error from 'components/Error'
import Layout from 'components/Layout'

function FallbackComponent() {
  return (
    <Layout bare>
      <Error headline="Unexpected Error" detail="Something went wrong" />
    </Layout>
  )
}

export default function AppErrorBoundary({ children }: React.PropsWithChildren<{}>) {
  const location = useLocation()
  const onError = React.useCallback((error: Error) => Sentry.captureException(error), [])
  return (
    <ErrorBoundary
      {...{ FallbackComponent, onError, children, resetKeys: [location.pathname] }}
    />
  )
}
