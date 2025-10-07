import * as React from 'react'
import * as M from '@material-ui/core'

import type { Revision } from './useRevisions'
import { Details, Date } from './Revision'

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
      return found ? <Date modified={found.modified} /> : hash
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
              primary={<Date modified={r.modified} />}
              secondary={<Details message={r.message} hash={r.hash} />}
            />
          </M.MenuItem>
        ))}
      </M.Select>
      {revision && (
        <M.FormHelperText className={classes.helperText}>
          <Details message={revision.message} hash={revision.hash} />
        </M.FormHelperText>
      )}
    </M.FormControl>
  )
}
