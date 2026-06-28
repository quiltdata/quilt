import * as R from 'ramda'
import * as React from 'react'

import tagged from 'utils/tagged'
import useMemoEq from 'utils/useMemoEq'

const State = tagged([
  'Idle',
  'Edited', // value
])

interface EditableValue<T> {
  value: T
  edited: boolean
  edit: () => void
  cancel: () => void
  change: (v: T) => void
  commit: () => void
  commitValue: (v: T) => void
}

export default function useEditableValue<T>(
  externalValue: T,
  onCommit: (v: T) => void,
): EditableValue<T> {
  const [state, setState] = React.useState(State.Idle())

  const edit = React.useCallback(() => {
    setState(State.Edited(externalValue))
  }, [externalValue])

  const cancel = React.useCallback(() => {
    setState(State.Idle())
  }, [])

  const change = React.useCallback((v: T) => {
    setState(State.mapCase({ Edited: () => v }))
  }, [])

  const commit = React.useCallback(() => {
    State.case(
      {
        Edited: (v: T) => {
          if (!R.equals(externalValue, v)) onCommit(v)
          cancel()
        },
        _: () => {},
      },
      state,
    )
  }, [externalValue, onCommit, cancel, state])

  const isEdited = State.Edited.is(state)
  const commitValue = React.useCallback(
    (v: T) => {
      if (!isEdited) return
      if (!R.equals(externalValue, v)) onCommit(v)
      cancel()
    },
    [externalValue, onCommit, cancel, isEdited],
  )

  const value: T = useMemoEq([state, externalValue], () =>
    State.case({ Idle: () => externalValue, Edited: (v: T) => v }, state),
  )

  const edited: boolean = useMemoEq(state, State.Edited.is)

  return { value, edited, edit, cancel, change, commit, commitValue }
}
