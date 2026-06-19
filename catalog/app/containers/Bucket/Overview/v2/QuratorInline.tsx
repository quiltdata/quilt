import * as React from 'react'
import * as M from '@material-ui/core'

import * as Assistant from 'components/Assistant'
import Chat from 'components/Assistant/UI/Chat/Chat'
import * as BucketPreferences from 'utils/BucketPreferences'

const useStyles = M.makeStyles((t) => ({
  root: {
    background: M.colors.indigo[50],
    display: 'flex',
    // Constrain so the conversation scrolls within the page instead of
    // growing unbounded as messages accumulate.
    maxHeight: '60vh',
    minHeight: t.spacing(20),
    overflow: 'hidden',
    position: 'relative',
  },
}))

export default function QuratorInline() {
  const classes = useStyles()

  const enabled = Assistant.Model.useIsEnabled()
  const api = Assistant.Model.useAssistantAPI()
  const { prefs } = BucketPreferences.use()

  // Leaving the Overview opens the global sidebar when a conversation is in progress.
  const show = api?.show
  const stateRef = React.useRef(api?.state)
  stateRef.current = api?.state
  React.useEffect(() => {
    if (!show) return undefined
    return () => {
      if ((stateRef.current?.events?.length ?? 0) > 0) show()
    }
  }, [show])

  return BucketPreferences.Result.match(
    {
      // Honor the per-bucket `ui.blocks.qurator` preference, like every other
      // per-bucket Qurator entry point, in addition to the stack-global enabled
      // and API-availability guards.
      Ok: ({ ui: { blocks } }) => {
        if (!blocks.qurator || !enabled || !api) return null
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
      },
      // Don't show the chat until prefs confirm it's allowed.
      _: () => null,
    },
    prefs,
  )
}
