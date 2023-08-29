import * as React from 'react'
import { Outlet, To, useLocation, useNavigate } from 'react-router-dom'
import * as M from '@material-ui/core'

import { createNotFound } from 'containers/NotFoundPage'
import * as ipc from 'embed/ipc'

function useSyncHistory() {
  const location = useLocation()
  const navigate = useNavigate()
  const messageParent = ipc.useMessageParent()

  ipc.useMessageHandler(
    React.useCallback(
      ({ type, ...data }: { type?: string; route?: To }) => {
        if (type !== 'navigate') return
        try {
          if (!data.route) throw new Error('missing .route')
          if (typeof data.route !== 'string') throw new Error('.route must be a string')
          navigate(data.route)
        } catch (e) {
          const message = `Navigate: error: ${(e as Error).message}`
          // eslint-disable-next-line no-console
          console.error(message)
          // eslint-disable-next-line no-console
          console.log('params:', data)
          messageParent({ type: 'error', message, data })
        }
      },
      [navigate, messageParent],
    ),
  )

  React.useEffect(
    () =>
      messageParent({
        type: 'navigate',
        route: `${location.pathname}${location.search}${location.hash}`,
        // action,
      }),
    [location, messageParent],
  )
}

interface StyledErrorProps {
  children: React.ReactNode
}

// TODO: re-use for ErrorBoundary
function StyledError({ children }: StyledErrorProps) {
  return (
    <M.Box
      display="flex"
      alignItems="center"
      justifyContent="center"
      height={400}
      maxHeight="90vh"
      textAlign="center"
    >
      <M.Typography variant="h3">{children}</M.Typography>
    </M.Box>
  )
}

const CatchNotFound = createNotFound(() => <StyledError>Page not found</StyledError>)

export default function PagesWrapper() {
  const l = useLocation()
  useSyncHistory()
  return (
    <CatchNotFound id={`${l.pathname}${l.search}${l.hash}`}>
      <Outlet />
    </CatchNotFound>
  )
}
