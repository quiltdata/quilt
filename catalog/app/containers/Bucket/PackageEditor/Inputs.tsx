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
  },
  group: {
    width: `calc(50% - ${t.spacing(2)}px)`,
    '& + &': {
      marginLeft: t.spacing(2),
    },
  },
  input: {
    '&+ &': {
      marginTop: '7px',
    },
  },
}))

export default function Inputs() {
  const { bucket, message, name, workflow } = State.use()
  const classes = useInputsStyles()
  return (
    <div className={classes.root}>
      <div className={classes.group}>
        <div className={classes.input}>
          {name.state === L ? (
            <InputSkeleton />
          ) : (
            <PackageName onChange={name.actions.onChange} {...name.state} />
          )}
        </div>
        <div className={classes.input}>
          {message.state === L ? (
            <InputSkeleton />
          ) : (
            <CommitMessage onChange={message.actions.onChange} {...message.state} />
          )}
        </div>
      </div>
      <div className={classes.group}>
        <div className={classes.input}>
          <DestinationBucket onChange={bucket.actions.onChange} {...bucket.state} />
        </div>
        <div className={classes.input}>
          {workflow.state === L ? (
            <InputSkeleton />
          ) : (
            <Workflow onChange={workflow.actions.onChange} {...workflow.state} />
          )}
        </div>
      </div>
    </div>
  )
}
