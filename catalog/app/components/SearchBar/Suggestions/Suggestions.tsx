import * as React from 'react'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import * as style from 'constants/style'
import { docs } from 'constants/urls'
import StyledLink from 'utils/StyledLink'

import type { Suggestion } from './model'

const ES_V = '6.8'

const useSuggestionsStyles = M.makeStyles((t) => ({
  item: {
    paddingLeft: t.spacing(5.5),

    '& b': {
      fontWeight: t.typography.fontWeightMedium,
    },
    '& code': {
      fontFamily: t.typography.monospace.fontFamily,
      fontSize: 'inherit',
    },
  },
  // The one row that changes destination rather than scope, matching the front
  // door's idiom: separated by a rule, on a neutral ground, with the amber
  // Indicator carried by the glyph -- a mark, never a wash.
  ask: {
    borderBottom: `1px solid ${t.palette.divider}`,
    paddingLeft: t.spacing(2),
  },
  askIcon: {
    color: t.palette.secondary.main,
    minWidth: t.spacing(3.5),
  },
  askGlyph: {
    fontSize: t.typography.body1.fontSize,
  },
  askWhere: {
    color: t.palette.text.secondary,
    fontSize: t.typography.caption.fontSize,
    fontWeight: t.typography.fontWeightMedium,
    marginLeft: t.spacing(2),
    whiteSpace: 'nowrap',
  },
  help: {
    ...t.typography.caption,
    borderTop: `1px solid ${t.palette.divider}`,
    marginTop: t.spacing(1),
    padding: t.spacing(2, 5.5, 1),
    color: t.palette.text.secondary,
  },
  helpExample: {
    borderBottom: `1px dotted ${t.palette.text.primary}`,
    cursor: 'help',
  },
}))

interface SuggestionsProps {
  items: Suggestion[]
  selected: number
  onAsk: ((query: string) => void) | null
}

function SuggestionsList({ items, selected, onAsk }: SuggestionsProps) {
  const classes = useSuggestionsStyles()
  return (
    <M.List>
      {items.map((item, index) =>
        item.kind === 'qurator' ? (
          <M.MenuItem
            button
            className={classes.ask}
            key={item.key}
            onClick={() => onAsk?.(item.query)}
            selected={selected === index}
          >
            <M.ListItemIcon className={classes.askIcon}>
              <M.Icon className={classes.askGlyph}>auto_awesome</M.Icon>
            </M.ListItemIcon>
            <M.ListItemText
              primary={
                <>
                  Ask <b>Qurator</b> &laquo;<b>{item.query}</b>&raquo;
                </>
              }
              primaryTypographyProps={{ variant: 'body2' }}
            />
            <span className={classes.askWhere}>natural language</span>
          </M.MenuItem>
        ) : (
          <M.MenuItem
            button
            className={classes.item}
            component={Link}
            key={item.key}
            selected={selected === index}
            to={item.url}
          >
            <M.ListItemText
              primary={
                <>
                  Search {item.what} {item.where}
                </>
              }
              primaryTypographyProps={{ variant: 'body2' }}
            />
          </M.MenuItem>
        ),
      )}
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
        <M.Paper className={classes?.paper} elevation={8}>
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
  onAsk?: ((query: string) => void) | null
  open: boolean
  suggestions: { items: Suggestion[]; selected: number }
}

export default function SuggestionsContainer({
  classes,
  onAsk = null,
  open,
  suggestions: { items, selected },
}: SuggestionsContainerProps) {
  if (!Array.isArray(items) || !items.length) return null
  return (
    <PaperWrapper classes={classes} open={open}>
      {open && <SuggestionsList items={items} selected={selected} onAsk={onAsk} />}
    </PaperWrapper>
  )
}
