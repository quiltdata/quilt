import * as React from 'react'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import * as style from 'constants/style'
import { docs } from 'constants/urls'
import StyledLink from 'utils/StyledLink'

import type { Suggestion } from './model'

const ES_V = '6.8'

const displaySuggestion = (s: Suggestion) => (
  <>
    Search {s.what} {s.where}
  </>
)

const useSuggestionsStyles = M.makeStyles((t) => ({
  item: {
    paddingLeft: t.spacing(5.5),

    '& b': {
      fontWeight: t.typography.fontWeightMedium,
    },
  },
  help: {
    ...t.typography.caption,
    borderTop: `1px solid ${t.palette.divider}`,
    marginTop: t.spacing(1),
    padding: t.spacing(2, 5.5, 1),
    color: t.palette.text.hint,
  },
  helpExample: {
    borderBottom: `1px dotted ${t.palette.text.primary}`,
    cursor: 'help',
  },
}))

interface SuggestionsProps {
  items: Suggestion[]
  selected: number
}

function SuggestionsList({ items, selected }: SuggestionsProps) {
  const classes = useSuggestionsStyles()
  return (
    <M.List>
      {items.map((item, index) => (
        <M.MenuItem
          button
          className={classes.item}
          component={Link}
          key={item.key}
          selected={selected === index}
          to={item.url}
        >
          <M.ListItemText primary={displaySuggestion(item)} />
        </M.MenuItem>
      ))}
      <div className={classes.help}>
        Learn the{' '}
        <StyledLink
          href={`${docs}/quilt-platform-catalog-user/search#search-bar`}
          target="_blank"
        >
          advanced search syntax
        </StyledLink>{' '}
        for query string queries in ElasticSearch {ES_V}.
      </div>
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
  suggestions: { items: Suggestion[]; selected: number }
}

export default function SuggestionsContainer({
  classes,
  open,
  suggestions: { items, selected },
}: SuggestionsContainerProps) {
  if (!Array.isArray(items) || !items.length) return null
  return (
    <PaperWrapper classes={classes} open={open}>
      {open && <SuggestionsList items={items} selected={selected} />}
    </PaperWrapper>
  )
}
