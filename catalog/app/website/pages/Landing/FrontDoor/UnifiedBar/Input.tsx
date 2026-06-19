import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import type { RouteKind } from './classify'

// FrontDoor v3-eval: white morphing search pill matching the prototype.

const useStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    background: t.palette.common.white,
    borderRadius: 34,
    boxShadow: '0 20px 60px -20px rgba(0,0,0,.6)',
    display: 'flex',
    position: 'relative',
    transition: 'box-shadow .25s',
  },
  rootQurator: {
    boxShadow: '0 20px 70px -16px rgba(84,113,241,.6)',
  },
  lead: {
    color: 'rgba(40,43,80,.45)',
    flex: 'none',
    marginLeft: t.spacing(3.5),
    transition: 'color .3s',
  },
  leadQurator: {
    color: t.palette.secondary.main,
  },
  input: {
    background: 'transparent',
    border: 0,
    color: '#282b50',
    flex: 1,
    font: 'inherit',
    fontSize: 24,
    fontWeight: 300,
    minWidth: 0,
    outline: 0,
    padding: t.spacing(2.5, 1.75, 2.5, 2.25),
    '&::placeholder': {
      color: 'rgba(40,43,80,.4)',
    },
  },
  badge: {
    borderRadius: 20,
    fontWeight: 500,
    marginRight: t.spacing(1),
  },
  badgeSearch: {
    background: 'rgba(40,43,80,.08)',
    color: '#282b50',
  },
  badgeQurator: {
    background: 'linear-gradient(225deg,rgba(106,147,255,.18),rgba(84,113,241,.18))',
    color: t.palette.secondary.main,
  },
  send: {
    alignItems: 'center',
    background: '#19163b',
    borderRadius: '50%',
    color: t.palette.common.white,
    display: 'grid',
    flex: 'none',
    height: 48,
    justifyItems: 'center',
    marginRight: t.spacing(1),
    placeItems: 'center',
    transition: 'transform .15s, background .25s',
    width: 48,
    '&:hover': {
      background: '#19163b',
      transform: 'scale(1.06)',
    },
  },
  sendQurator: {
    background: 'linear-gradient(225deg,#6a93ff,#5471f1)',
    '&:hover': {
      background: 'linear-gradient(225deg,#6a93ff,#5471f1)',
      transform: 'scale(1.06)',
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
      <M.IconButton
        aria-label="Run"
        className={cx(classes.send, isQurator && classes.sendQurator)}
        onClick={onSubmit}
      >
        <M.Icon style={{ fontSize: 22 }}>
          {isQurator ? 'arrow_upward' : 'arrow_forward'}
        </M.Icon>
      </M.IconButton>
    </div>
  )
}
