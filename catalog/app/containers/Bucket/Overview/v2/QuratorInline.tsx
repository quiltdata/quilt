import * as React from 'react'
import * as M from '@material-ui/core'

import * as Assistant from 'components/Assistant'
import Chat from 'components/Assistant/UI/Chat/Chat'
import * as InlinePresence from 'components/Assistant/UI/InlinePresence'
import * as BucketPreferences from 'utils/BucketPreferences'

import SectionCard from './SectionCard'

const useStyles = M.makeStyles((t) => ({
  root: {
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

  // Honor the per-bucket `ui.blocks.qurator` preference alongside the global
  // enabled + API-availability guards.
  const quratorEnabled = BucketPreferences.Result.match(
    { Ok: ({ ui: { blocks } }) => blocks.qurator, _: () => false },
    prefs,
  )
  const shown = enabled && !!api && quratorEnabled

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

  if (!shown || !api) return null

  // Registering the inline chat's presence suppresses the global Fab + sidebar.
  return (
    <InlinePresence.Provide value>
      <SectionCard tint flush className={classes.root}>
        <Chat
          state={api.state}
          dispatch={api.dispatch}
          devTools={api.devTools}
          connectors={api.connectors}
        />
      </SectionCard>
    </InlinePresence.Provide>
  )
}
