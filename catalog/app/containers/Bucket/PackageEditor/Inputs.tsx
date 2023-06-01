import React from 'react'
import * as M from '@material-ui/core'

import DestinationBucket from 'components/Form/Package/DestinationBucket'
import CommitMessage from 'components/Form/Package/CommitMessage'
import InputSkeleton from 'components/Form/Package/InputSkeleton'
import PackageName from 'components/Form/Package/PackageName'
import Workflow from 'components/Form/Package/Workflow'
import { L } from 'components/Form/Package/types'

import * as State from './State'

const useInputsStyles = M.makeStyles((t) => ({
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
  const { bucket, main, message, name, workflow } = State.use()
  const classes = useInputsStyles()

  const showErrors = main.state.submitted
  const disabled = main.state.submitting

  return (
    <div className={classes.root}>
      <div className={classes.group}>
        <div className={classes.input}>
          {name.state === L ? (
            <InputSkeleton />
          ) : (
            <PackageName
              {...name.state}
              disabled={disabled}
              errors={showErrors ? name.state.errors : undefined}
              onChange={name.actions.onChange}
            />
          )}
        </div>
        <div className={classes.input}>
          <CommitMessage
            {...message.state}
            disabled={disabled}
            errors={showErrors ? message.state.errors : undefined}
            onChange={message.actions.onChange}
          />
        </div>
      </div>
      <div className={classes.group}>
        <div className={classes.input}>
          <DestinationBucket
            {...bucket.state}
            disabled={disabled}
            onChange={bucket.actions.onChange}
          />
        </div>
        <div className={classes.input}>
          {workflow.state === L ? (
            <InputSkeleton />
          ) : (
            <Workflow
              {...workflow.state}
              disabled={disabled}
              errors={showErrors ? workflow.state.errors : undefined}
              onChange={workflow.actions.onChange}
            />
          )}
        </div>
      </div>
    </div>
  )
}
