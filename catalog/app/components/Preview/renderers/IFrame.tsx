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

export type EventName = 'list-files' | 'fetch-file'

interface IframeEvent extends MessageEvent<{ name: string; payload?: JsonRecord }> {}

interface IFrameProps extends React.HTMLProps<HTMLIFrameElement> {
  onMessage?: (event: { name: EventName; payload?: JsonRecord }) => Promise<any>
}

function IFrame({ onMessage, ...props }: IFrameProps) {
  const handleIframeEvents = React.useCallback(() => {
    if (!onMessage) return
    window.addEventListener('message', async (event: IframeEvent) => {
      if (!event.data.name) return
      const name = event.data.name.split(`${EVENT_NAMESPACE}-`)[1] as EventName
      if (!name) return
      const data = await onMessage({ ...event.data, name })
      event?.source?.postMessage({
        name: `${EVENT_NAMESPACE}-${name}`,
        data,
      })
    })
  }, [onMessage])

  React.useEffect(() => {
    if (!onMessage) return

    handleIframeEvents()
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
