import * as R from 'ramda'
import * as React from 'react'

import Error from 'components/Error'
import Layout from 'components/Layout'
import { createBoundary } from 'utils/ErrorBoundary'
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

export const createNotFound = (Component) =>
  createBoundary(
    (props) =>
      R.when(R.is(NotFoundError), (error) => <Component {...props} error={error} />),
    'CatchNotFound',
  )

export const CatchNotFound = createNotFound(NotFoundPage)
