import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import { fade } from '@material-ui/core/styles'

import type { RouteKind } from 'components/SearchBar/classify'

// The one bar. The prototype this came from (frontdoor/v3-eval) drew it as a
// white pill floating on a dark hero, with a cobalt glow and a gradient send
// button when the query routed to Qurator; here it's a working input on a light
// page -- a bordered surface, and the route change is carried by the Amber
// Indicator rather than by a second accent color.
const useStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    background: t.palette.background.paper,
    border: `1px solid ${t.palette.divider}`,
    borderRadius: 34,
    display: 'flex',
    position: 'relative',
    transition: t.transitions.create('border-color', { duration: 250 }),
    '&:focus-within': {
      borderColor: t.palette.primary.main,
    },
  },
  // Qurator routing is an indicator, not a mode change: the amber edge is the
  // same signal the rail uses, at the same weight as the focus border.
  rootQurator: {
    borderColor: t.palette.secondary.main,
  },
  lead: {
    color: t.palette.text.secondary,
    flex: 'none',
    marginLeft: t.spacing(3.5),
    transition: t.transitions.create('color', { duration: 300 }),
  },
  leadQurator: {
    color: t.palette.secondary.main,
  },
  input: {
    background: 'transparent',
    border: 0,
    color: t.palette.text.primary,
    flex: 1,
    font: 'inherit',
    fontSize: 20,
    minWidth: 0,
    outline: 0,
    padding: t.spacing(2.5, 1.75, 2.5, 2.25),
    '&::placeholder': {
      color: t.palette.text.hint,
    },
  },
  badge: {
    borderRadius: 20,
    fontWeight: t.typography.fontWeightMedium,
    marginRight: t.spacing(1),
  },
  badgeSearch: {
    background: t.palette.action.selected,
    color: t.palette.text.primary,
  },
  badgeQurator: {
    background: fade(t.palette.secondary.main, 0.15),
    border: `1px solid ${t.palette.secondary.main}`,
    color: t.palette.text.primary,
  },
  send: {
    alignItems: 'center',
    background: t.palette.primary.main,
    borderRadius: '50%',
    color: t.palette.common.white,
    display: 'grid',
    flex: 'none',
    height: 48,
    justifyItems: 'center',
    marginRight: t.spacing(1),
    placeItems: 'center',
    transition: t.transitions.create('background-color', { duration: 150 }),
    width: 48,
    '&:hover': {
      background: t.palette.primary.dark,
    },
    '&:focus-visible': {
      outline: `2px solid ${t.palette.primary.main}`,
      outlineOffset: 2,
    },
  },
}))

interface InputProps {
  route: RouteKind
  showRouteBadge: boolean
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
}

export default function Input({
  route,
  showRouteBadge,
  value,
  onChange,
  onSubmit,
}: InputProps) {
  const classes = useStyles()
  const isQurator = route === 'Qurator'
  return (
    <div className={cx(classes.root, isQurator && classes.rootQurator)} role="search">
      <M.Icon className={cx(classes.lead, isQurator && classes.leadQurator)}>
        {isQurator ? 'auto_awesome' : 'search'}
      </M.Icon>
      <input
        aria-label="Search or ask Qurator"
        className={classes.input}
        placeholder="Search or ask anything about your data…"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            onSubmit()
          } else if (event.key === 'Escape') {
            event.preventDefault()
            onChange('')
          }
        }}
      />
      {showRouteBadge && (
        <M.Chip
          className={cx(
            classes.badge,
            isQurator ? classes.badgeQurator : classes.badgeSearch,
          )}
          size="small"
          icon={
            <M.Icon style={{ fontSize: 15 }}>
              {isQurator ? 'auto_awesome' : 'search'}
            </M.Icon>
          }
          label={route}
        />
      )}
      <M.IconButton aria-label="Run" className={classes.send} onClick={onSubmit}>
        <M.Icon style={{ fontSize: 22 }}>
          {isQurator ? 'arrow_upward' : 'arrow_forward'}
        </M.Icon>
      </M.IconButton>
    </div>
  )
}
