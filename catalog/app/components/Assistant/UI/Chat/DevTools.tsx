import * as Eff from 'effect'
import * as React from 'react'
import * as M from '@material-ui/core'

import JsonDisplay from 'components/JsonDisplay'

import * as Model from '../../Model'

interface DevToolsProps {
  state: Model.Assistant.API['state']
  dispatch: Model.Assistant.API['dispatch']
  onToggle: () => void
}

export default function DevTools({ state, dispatch, onToggle }: DevToolsProps) {
  const context = Model.Context.useAggregatedContext()

  const prompt = React.useMemo(
    () =>
      Eff.Effect.runSync(
        Model.Conversation.constructPrompt(
          state.events.filter((e) => !e.discarded),
          context,
        ),
      ),
    [state, context],
  )

  return (
    <>
      <JsonDisplay name="Context" value={context} />
      <JsonDisplay name="State" value={state} />
      <JsonDisplay name="Prompt" value={prompt} />

      <M.Button onClick={onToggle}>Close</M.Button>
    </>
  )
}
