import * as dateFns from 'date-fns'
import * as React from 'react'
import * as M from '@material-ui/core'

import type { RevisionsListItem } from './useRevisionsList'

const useDetailsStyles = M.makeStyles((t) => ({
  message: {
    display: 'block',
  },
  hash: {
    ...t.typography.monospace,
    display: 'block',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
}))

interface DetailsProps {
  message: string | null
  hash: string
}

function Details({ message, hash }: DetailsProps) {
  const classes = useDetailsStyles()
  return (
    <>
      <span className={classes.message}>{message || 'No message'}</span>
      <span className={classes.hash}>{hash}</span>
    </>
  )
}

interface DateProps {
  modified: Date
}

function Date({ modified }: DateProps) {
  return <>{dateFns.format(modified, 'MMM d yyyy - h:mma')}</>
}

const useStyles = M.makeStyles({
  root: {
    overflow: 'hidden',
  },
  helperText: {
    display: 'flex',
    justifyContent: 'space-between',
  },
})

interface RevisionSelectProps {
  value: string
  revisions: readonly RevisionsListItem[]
  onChange: (hash: string) => void
  other?: boolean
}

export default function RevisionSelect({
  value,
  revisions,
  onChange,
  other = false,
}: RevisionSelectProps) {
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
        {other && (
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
