import * as R from 'ramda'
import * as React from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import type { ErrorBoundaryPropsWithRender, FallbackProps } from 'react-error-boundary'

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

type ComponentFallback = React.ComponentType<FallbackProps>

type ErrorBoundaryOverrides = React.PropsWithChildren<
  Partial<ErrorBoundaryPropsWithRender>
>

export const createNotFound =
  (Component: ComponentFallback) => (props: ErrorBoundaryOverrides) => (
    <ErrorBoundary
      fallbackRender={({ error, resetErrorBoundary }) =>
        R.is(NotFoundError, error) ? (
          <Component {...{ error, resetErrorBoundary }} />
        ) : null
      }
      {...props}
    />
  )

export const CatchNotFound = createNotFound(NotFoundPage)
