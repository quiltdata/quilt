import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import type { MetaState } from '../State/meta'
import { requiredFields } from '../State/metaGuide'
import type { SchemaStatus } from '../State/schema'

const useStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    border: `1px solid ${t.palette.divider}`,
    borderRadius: t.shape.borderRadius,
    display: 'flex',
    gap: t.spacing(1.5),
    marginTop: t.spacing(3),
    padding: t.spacing(1.5, 2),
    textAlign: 'left',
    width: '100%',
    '&:hover': {
      borderColor: t.palette.text.secondary,
    },
    // stacked layout puts the metadata tab right below; the card only repeats it
    [t.breakpoints.down('xs')]: {
      display: 'none',
    },
    '&.Mui-focusVisible': {
      outline: `2px solid ${t.palette.primary.main}`,
      outlineOffset: 2,
    },
  },
  icon: {
    color: t.palette.text.secondary,
  },
  done: {
    color: t.palette.success.main,
  },
  text: {
    flexGrow: 1,
    minWidth: 0,
  },
  title: {
    ...t.typography.subtitle2,
  },
  sub: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
  },
}))

interface MetaSummaryProps {
  onOpen: () => void
  schema: SchemaStatus
  state: MetaState
}

/** Where metadata stands, in the left column; the editor itself has the wide pane. */
export default function MetaSummary({ onOpen, schema, state }: MetaSummaryProps) {
  const classes = useStyles()
  const s = schema._tag === 'ready' ? schema.schema : undefined
  const required = requiredFields(s, state.value)
  const filled = required.filter((f) => f.filled).length
  const fields = Object.keys(state.value || {}).length
  const ok = state.status._tag === 'ok'
  // with nothing required, an empty form is not "done", just empty
  const complete = ok && (required.length ? filled === required.length : fields > 0)
  let sub = fields ? `${fields} field${fields === 1 ? '' : 's'} set` : 'No fields yet'
  if (required.length)
    sub = `${filled} of ${required.length} required · ${sub.toLowerCase()}`
  if (!ok && (state.touched || required.length === filled)) sub += ' · needs fixes'
  return (
    <M.ButtonBase
      className={classes.root}
      onClick={onOpen}
      aria-label={`Metadata: ${sub}. Open the metadata editor`}
    >
      <M.Icon className={cx(classes.icon, { [classes.done]: complete })}>
        {complete ? 'task_alt' : 'edit_note'}
      </M.Icon>
      <span className={classes.text}>
        <span className={classes.title}>Metadata</span>
        <br />
        <span className={classes.sub}>{sub}</span>
      </span>
      <M.Icon className={classes.icon}>chevron_right</M.Icon>
    </M.ButtonBase>
  )
}
