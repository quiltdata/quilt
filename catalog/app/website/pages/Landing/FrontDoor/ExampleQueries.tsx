import * as React from 'react'
import * as M from '@material-ui/core'

import useExampleQueries from './useExampleQueries'

const useStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: t.spacing(1.25),
    justifyContent: 'center',
    marginTop: t.spacing(2.5),
  },
  chip: {
    background:
      t.palette.type === 'dark' ? 'rgba(255,255,255,.06)' : t.palette.common.white,
    border:
      t.palette.type === 'dark'
        ? '1px solid rgba(255,255,255,.12)'
        : '1px solid rgba(40,43,80,.15)',
    borderRadius: 20,
    color: t.palette.text.secondary,
    transition: 'all .15s',
    '&:hover': {
      background: 'rgba(84,113,241,.18)',
      borderColor: 'rgba(106,147,255,.5)',
      color: t.palette.type === 'dark' ? t.palette.common.white : '#282b50',
    },
  },
  chipIcon: {
    color: t.palette.type === 'dark' ? '#6a93ff' : '#5471f1',
  },
}))

interface ExampleQueriesProps {
  onSelect: (query: string) => void
}

export default function ExampleQueries({ onSelect }: ExampleQueriesProps) {
  const classes = useStyles()
  const examples = useExampleQueries()
  return (
    <div className={classes.root} aria-label="Example queries">
      {examples.map(({ icon, label }) => (
        <M.Chip
          key={label}
          className={classes.chip}
          icon={<M.Icon className={classes.chipIcon}>{icon}</M.Icon>}
          label={label}
          clickable
          onClick={() => onSelect(label)}
        />
      ))}
    </div>
  )
}
