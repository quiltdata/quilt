import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

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
    transition: t.transitions.create('border-color', { duration: 150 }),
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
    marginLeft: t.spacing(3),
    transition: t.transitions.create('color', { duration: 150 }),
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
    fontSize: t.typography.h6.fontSize,
    minWidth: 0,
    outline: 0,
    padding: t.spacing(2, 2, 2, 2),
    '&::placeholder': {
      color: t.palette.text.hint,
    },
  },
  badge: {
    fontWeight: t.typography.fontWeightMedium,
    marginRight: t.spacing(1),
  },
  badgeSearch: {
    background: t.palette.action.selected,
    color: t.palette.text.primary,
  },
  // Amber is a stroke and a mark, never a wash: border and glyph carry the
  // Indicator on the paper ground.
  badgeQurator: {
    background: t.palette.background.paper,
    border: `1px solid ${t.palette.secondary.main}`,
    color: t.palette.text.primary,
  },
  badgeIcon: {
    fontSize: t.typography.body1.fontSize,
  },
  sendIcon: {
    fontSize: t.typography.h6.fontSize,
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
  // Combobox wiring. The field owns the suggestions list below it, so it has to
  // say so: which list, whether it's showing, and which row is highlighted.
  // Omitted (the Qurator route shows a panel, not a list) collapses this back to
  // a plain labelled text field.
  listId?: string
  expanded?: boolean
  activeOptionId?: string | null
  onArrow?: (reverse: boolean) => void
  // Escape means "back out one step" -- the parent decides whether that step is
  // dropping the highlight or clearing the query, because only it knows if a row
  // is highlighted.
  onEscape?: () => void
}

export default function Input({
  route,
  showRouteBadge,
  value,
  onChange,
  onSubmit,
  listId,
  expanded = false,
  activeOptionId = null,
  onArrow,
  onEscape,
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
        // The arrow-key highlight below is a CSS class unless it's announced
        // here. `aria-controls` is required on a combobox and names the list
        // whether or not it's currently drawn -- an unresolvable IDREF is
        // ignored by AT. `aria-activedescendant` is the opposite: it moves the
        // AT cursor, so naming a row that isn't there strands it.
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listId}
        {...(expanded && activeOptionId
          ? { 'aria-activedescendant': activeOptionId }
          : null)}
        onChange={(event) => onChange(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            onSubmit()
          } else if (event.key === 'Escape') {
            event.preventDefault()
            if (onEscape) onEscape()
            else onChange('')
          } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            if (!onArrow) return
            // Stop the caret from jumping to either end of the value while the
            // same keypress is moving the highlight.
            event.preventDefault()
            onArrow(event.key === 'ArrowUp')
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
            <M.Icon className={classes.badgeIcon}>
              {isQurator ? 'auto_awesome' : 'search'}
            </M.Icon>
          }
          label={route}
        />
      )}
      <M.IconButton aria-label="Run" className={classes.send} onClick={onSubmit}>
        <M.Icon className={classes.sendIcon}>
          {isQurator ? 'arrow_upward' : 'arrow_forward'}
        </M.Icon>
      </M.IconButton>
    </div>
  )
}
