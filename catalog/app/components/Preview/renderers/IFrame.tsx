import * as React from 'react'
import * as M from '@material-ui/core'

import type { JsonRecord } from 'utils/types'

const useStyles = M.makeStyles({
  root: {
    border: 'none',
    height: '90vh',
    width: '100%',
  },
})

export const EVENT_NAMESPACE = 'quilt-iframe-request'

export type EventName = 'list-files' | 'get-file-url'

interface IframeEvent
  extends MessageEvent<{ id: string; name: string; payload?: JsonRecord }> {}

interface IFrameProps extends React.HTMLProps<HTMLIFrameElement> {
  onMessage?: (event: { name: EventName; payload?: JsonRecord }) => Promise<any>
}

function IFrame({ onMessage, ...props }: IFrameProps) {
  const handleIframeEvents = React.useCallback(
    async (event: IframeEvent) => {
      if (!onMessage || !event.data.name) return
      const name = event.data.name.split(`${EVENT_NAMESPACE}-`)[1] as EventName
      if (!name || !event.data.id) return
      const data = await onMessage({ ...event.data, name })
      event?.source?.postMessage({
        id: event.data.id,
        name: `${EVENT_NAMESPACE}-${name}`,
        data,
      })
    },
    [onMessage],
  )

  React.useEffect(() => {
    if (!onMessage) return
    window.addEventListener('message', handleIframeEvents)
    return () => window.removeEventListener('message', handleIframeEvents)
  }, [onMessage, handleIframeEvents])

  const classes = useStyles()
  return (
    <iframe
      className={classes.root}
      title="Preview"
      sandbox="allow-scripts allow-same-origin"
      {...props}
    />
  )
}

export default (ifr: IFrameProps, props: React.HTMLProps<HTMLIFrameElement>) => (
  <IFrame {...ifr} {...props} />
)
