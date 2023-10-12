import * as React from 'react'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import * as style from 'constants/style'

import { useNavBar } from '../Provider'
import type { Item } from './model'

const useSuggestionsStyles = M.makeStyles((t) => ({
  item: {
    paddingLeft: t.spacing(8.5),
  },
}))

interface SuggestionsProps {
  items: Item[]
  selected: number
}

function SuggestionsList({ items, selected }: SuggestionsProps) {
  const classes = useSuggestionsStyles()
  return (
    <M.List>
      {items.map(({ key, title, url }, index) => (
        <M.MenuItem
          button
          className={classes.item}
          component={Link}
          key={key}
          selected={selected === index}
          to={url}
        >
          <M.ListItemText primary={title} />
        </M.MenuItem>
      ))}
    </M.List>
  )
}

interface PaperWrapperProps {
  classes?: {
    paper?: string
    contents?: string
  }
  children: React.ReactNode
  open: boolean
}

function PaperWrapper({ children, classes, open }: PaperWrapperProps) {
  return (
    <M.MuiThemeProvider theme={style.appTheme}>
      <M.Fade in={open}>
        <M.Paper className={classes?.paper}>
          <div className={classes?.contents}>{children}</div>
        </M.Paper>
      </M.Fade>
    </M.MuiThemeProvider>
  )
}

interface SuggestionsContainerProps {
  classes?: {
    paper?: string
    contents?: string
  }
  open: boolean
}

export default function SuggestionsContainer({
  classes,
  open,
}: SuggestionsContainerProps) {
  const navbarModel = useNavBar()
  if (!navbarModel) return null
  const {
    suggestions: { items, selected },
  } = navbarModel
  if (!Array.isArray(items) || !items.length) return null
  return (
    <PaperWrapper classes={classes} open={open}>
      {open && <SuggestionsList items={items} selected={selected} />}
    </PaperWrapper>
  )
}
