import * as dateFns from 'date-fns'
import * as React from 'react'
import * as M from '@material-ui/core'

import type { Revision } from './useRevisions'

const useStyles = M.makeStyles((t) => ({
  root: {
    overflow: 'hidden',
  },
  hash: {
    fontFamily: t.typography.monospace.fontFamily,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  helperText: {
    display: 'flex',
    justifyContent: 'space-between',
  },
}))

interface RevisionsListProps {
  revisions: readonly Revision[]
  value: string
  onChange: (hash: string) => void
  temporaryRemoveNone?: boolean
}

export default function RevisionsList({
  temporaryRemoveNone = false,
  revisions,
  onChange,
  value,
}: RevisionsListProps) {
  const classes = useStyles()

  const handleChange = (event: React.ChangeEvent<{ value: unknown }>) => {
    onChange(event.target.value as string)
  }
  const revision = React.useMemo(
    () => revisions.find((r) => r.hash === value),
    [value, revisions],
  )
  const renderValue = React.useCallback(
    (hash) => {
      const found = revisions.find((r) => r.hash === hash)
      return found ? dateFns.format(found.modified, 'MMM d yyyy - h:mma') : hash
    },
    [revisions],
  )

  return (
    <M.FormControl>
      <M.Select
        value={value}
        onChange={handleChange}
        displayEmpty
        fullWidth
        className={classes.root}
        renderValue={renderValue}
      >
        {!temporaryRemoveNone && (
          <M.MenuItem value="">
            <em>None</em>
          </M.MenuItem>
        )}
        {revisions.map((r) => (
          <M.MenuItem key={r.hash} value={r.hash}>
            <M.ListItemText
              primary={dateFns.format(r.modified, 'MMM d yyyy - h:mma')}
              secondary={
                <>
                  {r.message || 'No message'}
                  <br />
                  <span className={classes.hash}>{r.hash}</span>
                </>
              }
            />
          </M.MenuItem>
        ))}
      </M.Select>
      {revision && (
        <M.FormHelperText className={classes.helperText}>
          <span>{revision.message}</span>
          <span>{revision.hash}</span>
        </M.FormHelperText>
      )}
    </M.FormControl>
  )
}
