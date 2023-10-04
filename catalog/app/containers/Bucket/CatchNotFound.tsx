import * as React from 'react'
import * as redux from 'react-redux'
import * as M from '@material-ui/core'

import Error from 'components/Error'
import * as authSelectors from 'containers/Auth/selectors'
import { createNotFound } from 'containers/NotFoundPage'

const CatchNotFound = createNotFound(() => {
  const username = redux.useSelector(authSelectors.username)
  const helpText = username
    ? 'Try to navigate using one of these tabs above'
    : 'Do you need to log in?'
  return (
    <M.Box mt={4}>
      <Error headline="Nothing here" detail={helpText} />
    </M.Box>
  )
})

export default CatchNotFound
