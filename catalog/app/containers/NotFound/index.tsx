import * as React from 'react'
import * as redux from 'react-redux'
import * as M from '@material-ui/core'

import Error from 'components/Error'
import Layout from 'components/Layout'
import * as authSelectors from 'containers/Auth/selectors'

interface NotFoundProps {
  detail?: React.ReactNode
}

export function NotFound({ detail = 'Do you need to log in?' }: NotFoundProps) {
  return (
    <M.Box mt={4}>
      <Error headline="Nothing here" detail={detail} />
    </M.Box>
  )
}

export function NotFoundInTabs() {
  const username = redux.useSelector(authSelectors.username)
  return username ? (
    <NotFound detail="Try to navigate using one of these tabs above" />
  ) : (
    <NotFound />
  )
}

export function NotFoundPage() {
  return (
    <Layout
      pre={
        <M.Container maxWidth="lg">
          <NotFound />
        </M.Container>
      }
    />
  )
}
