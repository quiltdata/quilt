import * as R from 'ramda'
import * as React from 'react'
import { ErrorBoundary } from 'react-error-boundary'

import Error from 'components/Error'
import Layout from 'components/Layout'
import { BaseError } from 'utils/error'

export default function NotFoundPage() {
  return (
    <Layout>
      <Error headline="Nothing here" detail="Do you need to log in?" />
    </Layout>
  )
}

export class NotFoundError extends BaseError {}

export const ThrowNotFound = () => {
  throw new NotFoundError()
}

export const createNotFound =
  (Component) =>
  ({ children, resetKeys }) => (
    <ErrorBoundary
      fallbackRender={({ error, resetErrorBoundary }) =>
        R.is(NotFoundError, error) ? (
          <Component {...{ error, resetErrorBoundary }} />
        ) : null
      }
      resetKeys={resetKeys}
    >
      {children}
    </ErrorBoundary>
  )

export const CatchNotFound = createNotFound(NotFoundPage)
