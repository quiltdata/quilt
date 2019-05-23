import * as R from 'ramda'
import * as React from 'react'

import Error from 'components/Error'
import Layout from 'components/Layout'
import { createBoundary } from 'utils/ErrorBoundary'
import { BaseError } from 'utils/error'
import { composeComponent } from 'utils/reactTools'

export const NotFoundPage = composeComponent('NotFoundPage', () => (
  <Layout>
    <Error headline="Nothing here" detail="Do you need to log in?" />
  </Layout>
))

export default NotFoundPage

export class NotFoundError extends BaseError {}

export const ThrowNotFound = () => {
  throw new NotFoundError()
}

export const CatchNotFound = createBoundary(
  () => R.when(R.is(NotFoundError), () => <NotFoundPage />),
  'CatchNotFound',
)
