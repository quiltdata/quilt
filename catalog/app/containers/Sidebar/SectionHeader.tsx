import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  root: {
    flexShrink: 0,
  },
  iconWrapper: {
    minWidth: t.spacing(4),
  },
  // A triangle that points right when collapsed and down when expanded — a
  // left-side disclosure marker that reads as a section header (and avoids
  // clashing with the right-side chevrons of collapsible list items).
  icon: {
    color: t.palette.action.active,
    transition: 'ease .15s transform',
  },
  expanded: {
    transform: 'rotate(90deg)',
  },
  title: {
    ...t.typography.subtitle1,
    fontWeight: 500,
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
      <M.ListItemIcon className={classes.iconWrapper}>
        <M.Icon className={cx(classes.icon, { [classes.expanded]: expanded })}>
          arrow_right
        </M.Icon>
      </M.ListItemIcon>
      <M.ListItemText
        primary={title}
        primaryTypographyProps={{ className: classes.title }}
      />
    </M.ListItem>
  )
}
