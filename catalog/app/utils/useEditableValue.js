import * as R from 'ramda'
import * as React from 'react'

import tagged from 'utils/tagged'
import useMemoEq from 'utils/useMemoEq'

const State = tagged([
  'Idle',
  'Edited', // value
])

export default function useEditableValue(externalValue, onCommit) {
  const [state, setState] = React.useState(State.Idle())

  const edit = React.useCallback(() => {
    setState(State.Edited(externalValue))
  }, [externalValue])

  const cancel = React.useCallback(() => {
    setState(State.Idle())
  }, [])

  const change = React.useCallback((v) => {
    setState(State.mapCase({ Edited: () => v }))
  }, [])

  const commit = React.useCallback(() => {
    State.case(
      {
        Edited: (v) => {
          if (!R.equals(externalValue, v)) onCommit(v)
          cancel()
        },
        _: () => {},
      },
      state,
    )
  }, [externalValue, onCommit, cancel, state])

  const commitValue = React.useCallback(
    (v) => {
      State.case(
        {
          Edited: () => {
            if (!R.equals(externalValue, v)) onCommit(v)
            cancel()
          },
          _: () => {},
        },
        state,
      )
    },
    [externalValue, onCommit, cancel, state],
  )

  const value = useMemoEq([state, externalValue], () =>
    State.case({ Idle: () => externalValue, Edited: (v) => v }, state),
  )

  const edited = useMemoEq(state, State.Edited.is)

  return { value, edited, edit, cancel, change, commit, commitValue }
}
