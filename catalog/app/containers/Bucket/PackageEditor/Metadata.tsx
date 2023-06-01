import * as React from 'react'
import * as M from '@material-ui/core'

import { L } from 'components/Form/Package/types'
import JsonEditor from 'components/JsonEditor'
import JsonValidationErrors from 'components/JsonValidationErrors'
import { MetaInputSkeleton } from '../PackageDialog/Skeleton'

import * as State from './State'

const useStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
  },
  errors: {
    marginTop: t.spacing(1),
  },
}))

export default function Metadata() {
  const { main, meta } = State.use()
  const classes = useStyles()
  if (meta.state === L) return <MetaInputSkeleton />
  return (
    <div className={classes.root}>
      <JsonEditor
        disabled={main.state.submitting}
        errors={meta.state.errors || []}
        multiColumned
        onChange={meta.actions.onChange}
        schema={meta.state.schema}
        value={meta.state.value}
      />
      <JsonValidationErrors className={classes.errors} error={meta.state.errors || []} />
    </div>
  )
}
