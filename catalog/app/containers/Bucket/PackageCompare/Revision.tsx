import * as dateFns from 'date-fns'
import * as React from 'react'
import * as M from '@material-ui/core'

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

export function Details({ message, hash }: DetailsProps) {
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

export function Date({ modified }: DateProps) {
  return <>{dateFns.format(modified, 'MMM d yyyy - h:mma')}</>
}
