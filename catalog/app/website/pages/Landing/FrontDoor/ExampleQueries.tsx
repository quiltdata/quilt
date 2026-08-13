import * as React from 'react'
import * as M from '@material-ui/core'

import useExampleQueries from './useExampleQueries'

// Seed queries under the bar. The prototype drew these as translucent chips on
// a dark hero that lit up cobalt on hover; here they're ordinary outlined chips
// that take the standard hover ground.
const useStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: t.spacing(1.25),
    justifyContent: 'center',
    marginTop: t.spacing(2.5),
  },
  chip: {
    background: t.palette.background.paper,
    border: `1px solid ${t.palette.divider}`,
    borderRadius: 20,
    color: t.palette.text.secondary,
    transition: t.transitions.create(['background-color', 'border-color', 'color'], {
      duration: 150,
    }),
    '&:hover': {
      backgroundColor: t.palette.action.hover,
      borderColor: t.palette.text.secondary,
      color: t.palette.text.primary,
    },
    '&.Mui-focusVisible': {
      outline: `2px solid ${t.palette.primary.main}`,
      outlineOffset: -2,
    },
  },
  chipIcon: {
    color: t.palette.text.secondary,
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
