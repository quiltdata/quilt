import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import Skeleton from 'components/Skeleton'
import type * as AWS from 'utils/AWS'

import History from './History'
import Input from './Input'

const useStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    overflow: 'hidden',
  },
  error: {
    marginTop: t.spacing(2),
  },
  history: {
    ...t.typography.body1,
    maxHeight: t.spacing(70),
    overflowY: 'auto',
  },
  input: {
    marginTop: t.spacing(2),
  },
}))

const noMessages: AWS.Bedrock.Message[] = []

export function ChatSkeleton() {
  const classes = useStyles()
  return (
    <div className={classes.root}>
      <History loading messages={noMessages} />
      <Skeleton className={classes.input} height="32px" />
    </div>
  )
}

const Submitting = Symbol('Submitting')

interface ChatProps {
  initializing: boolean
  history: AWS.Bedrock.History
  onSubmit: (value: string) => Promise<void>
}

export default function Chat({ history, onSubmit, initializing }: ChatProps) {
  const classes = useStyles()

  const [value, setValue] = React.useState('')
  const [state, setState] = React.useState<Error | typeof Submitting | null>(null)

  const handleSubmit = React.useCallback(async () => {
    if (state) return

    setState(Submitting)
    try {
      await onSubmit(value)
      setValue('')
    } catch (e) {
      setState(e instanceof Error ? e : new Error('Failed to submit message'))
    }
    setState(null)
  }, [state, onSubmit, value])

  return (
    <div className={classes.root}>
      <History
        className={classes.history}
        loading={state === Submitting || initializing}
        messages={history.messages}
      />
      {state instanceof Error && (
        <Lab.Alert className={classes.error} severity="error">
          {state.message}
        </Lab.Alert>
      )}
      <Input
        className={classes.input}
        disabled={state === Submitting || initializing}
        onChange={setValue}
        onSubmit={handleSubmit}
        value={value}
      />
    </div>
  )
}
