import * as React from 'react'
import * as redux from 'react-redux'
import * as M from '@material-ui/core'

import Error from 'components/Error'
import * as authSelectors from 'containers/Auth/selectors'

export default function NotFound() {
  const username = redux.useSelector(authSelectors.username)
  const helpText = username
    ? 'Try to navigate using one of these tabs above'
    : 'Do you need to log in?'
  return (
    <M.Box mt={4}>
      <Error headline="Nothing here" detail={helpText} />
    </M.Box>
  )
}
