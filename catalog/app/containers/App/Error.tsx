import * as React from 'react'
import { useRouteError, isRouteErrorResponse } from 'react-router-dom'

import Error from 'components/Error'

export default function ErrorElement() {
  let error = useRouteError()
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : (error as Error).message || error
  return <Error detail={message} />
}
