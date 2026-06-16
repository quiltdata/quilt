import * as React from 'react'
import * as M from '@material-ui/core'

import * as Assistant from 'components/Assistant'
import Chat from 'components/Assistant/UI/Chat/Chat'

const useStyles = M.makeStyles((t) => ({
  root: {
    background: M.colors.indigo[50],
    display: 'flex',
    // Constrain so the conversation scrolls within the page instead of
    // growing unbounded as messages accumulate.
    maxHeight: '60vh',
    minHeight: t.spacing(20),
    overflow: 'hidden',
  },
}))

export default function QuratorInline() {
  const classes = useStyles()

  const enabled = Assistant.Model.useIsEnabled()
  const api = Assistant.Model.useAssistantAPI()

  if (!enabled || !api) return null

  return (
    <M.Paper className={classes.root}>
      <Chat
        state={api.state}
        dispatch={api.dispatch}
        devTools={api.devTools}
        connectors={api.connectors}
      />
    </M.Paper>
  )
}
