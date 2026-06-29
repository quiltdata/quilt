import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  root: {
    flexShrink: 0,
  },
  title: {
    ...t.typography.subtitle1,
    fontWeight: 500,
  },
  chevron: {
    color: t.palette.action.active,
  },
}))

interface SectionHeaderProps {
  title: string
  expanded: boolean
  onToggle: () => void
}

export function SectionHeader({ title, expanded, onToggle }: SectionHeaderProps) {
  const classes = useStyles()
  return (
    <M.ListItem button dense component="div" onClick={onToggle} className={classes.root}>
      <M.ListItemText
        primary={title}
        primaryTypographyProps={{ className: classes.title }}
      />
      <M.Icon className={classes.chevron} fontSize="small">
        {expanded ? 'expand_less' : 'expand_more'}
      </M.Icon>
    </M.ListItem>
  )
}
