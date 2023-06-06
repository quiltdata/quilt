import React from 'react'
import * as M from '@material-ui/core'

import DestinationBucket from 'components/Form/Package/DestinationBucket'
import CommitMessage from 'components/Form/Package/CommitMessage'
import InputSkeleton from 'components/Form/Package/InputSkeleton'
import PackageName from 'components/Form/Package/PackageName'
import Workflow from 'components/Form/Package/Workflow'
import L from 'constants/loading'

import * as State from './State'

interface InputFieldProps {
  disabled: boolean
  showErrors: boolean
}

function PackageNameContainer({ disabled, showErrors }: InputFieldProps) {
  const {
    fields: { name },
  } = State.use()
  if (name.state === L) return <InputSkeleton />
  return (
    <PackageName
      value={name.state.value}
      warnings={name.state.warnings}
      disabled={disabled}
      errors={showErrors ? name.state.errors : undefined}
      onChange={name.actions.onChange}
    />
  )
}

function CommitMessageContainer({ disabled, showErrors }: InputFieldProps) {
  const {
    fields: { message },
  } = State.use()
  return (
    <CommitMessage
      {...message.state}
      disabled={disabled}
      errors={showErrors ? message.state.errors : undefined}
      onChange={message.actions.onChange}
    />
  )
}

function DestinationBucketContainer({ disabled }: Omit<InputFieldProps, 'showErrors'>) {
  const {
    fields: { bucket },
  } = State.use()
  return (
    <DestinationBucket
      {...bucket.state}
      disabled={disabled}
      onChange={bucket.actions.onChange}
    />
  )
}

function WorkflowContainer({ disabled, showErrors }: InputFieldProps) {
  const {
    fields: { workflow },
  } = State.use()
  if (workflow.state === L) return <InputSkeleton />
  return (
    <Workflow
      {...workflow.state}
      disabled={disabled}
      errors={showErrors ? workflow.state.errors : undefined}
      onChange={workflow.actions.onChange}
    />
  )
}

const useStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  group: {
    width: `calc(50% - ${t.spacing(4)}px)`,
    '& + &': {
      marginLeft: t.spacing(8),
    },
  },
  input: {
    '&+ &': {
      marginTop: '7px',
    },
  },
}))

export default function Inputs() {
  const { main } = State.use()
  const classes = useStyles()

  const showErrors = main.state.submitted
  const disabled = main.state.status === L

  return (
    <div className={classes.root}>
      <div className={classes.group}>
        <div className={classes.input}>
          <PackageNameContainer disabled={disabled} showErrors={showErrors} />
        </div>
        <div className={classes.input}>
          <CommitMessageContainer disabled={disabled} showErrors={showErrors} />
        </div>
      </div>
      <div className={classes.group}>
        <div className={classes.input}>
          <DestinationBucketContainer disabled={disabled} />
        </div>
        <div className={classes.input}>
          <WorkflowContainer disabled={disabled} showErrors={showErrors} />
        </div>
      </div>
    </div>
  )
}
