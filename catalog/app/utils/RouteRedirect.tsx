import * as React from 'react'
import * as RRDom from 'react-router-dom'

// react-router@5's <Redirect> runs `createLocation` before `history.replace` runs it
// again, so the pathname is `decodeURI`d twice and an encoded `%` in it throws.
export default function RouteRedirect({ to }: { to: string }) {
  const history = RRDom.useHistory()
  React.useLayoutEffect(() => {
    history.replace(to)
  }, [history, to])
  return null
}
