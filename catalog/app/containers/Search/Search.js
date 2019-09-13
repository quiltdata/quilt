import { push } from 'connected-react-router/esm/immutable'
import * as R from 'ramda'
import * as React from 'react'
import * as redux from 'react-redux'
import * as M from '@material-ui/core'

import Layout from 'components/Layout'
import Message from 'components/Message'
import Pagination from 'components/Pagination2'
import * as SearchResults from 'components/SearchResults'
import * as AWS from 'utils/AWS'
import * as Config from 'utils/Config'
import * as Data from 'utils/Data'
import Delay from 'utils/Delay'
import * as NamedRoutes from 'utils/NamedRoutes'
import parseSearch from 'utils/parseSearch'
import search from 'utils/search'
import useEditableValue from 'utils/useEditableValue'
import usePrevious from 'utils/usePrevious'

const PER_PAGE = 10

function Alt({ ...props }) {
  return (
    <M.Box
      borderTop={{ xs: 1, sm: 0 }}
      borderColor="divider"
      pt={3}
      px={{ xs: 2, sm: 0 }}
      {...props}
    />
  )
}

function Hits({ hits, page, scrollRef, makePageUrl }) {
  const actualPage = page || 1
  const pages = Math.ceil(hits.length / PER_PAGE)

  const paginated = React.useMemo(
    () =>
      pages === 1 ? hits : hits.slice((actualPage - 1) * PER_PAGE, actualPage * PER_PAGE),
    [hits, actualPage],
  )

  usePrevious(actualPage, (prev) => {
    if (prev && actualPage !== prev && scrollRef.current) {
      scrollRef.current.scrollIntoView()
    }
  })

  return (
    <>
      {paginated.map((hit) => (
        <SearchResults.Hit key={hit.path} hit={hit} showBucket />
      ))}
      {pages > 1 && <Pagination {...{ pages, page: actualPage, makePageUrl }} />}
    </>
  )
}

function Results({ buckets, query, page, scrollRef, makePageUrl }) {
  const cfg = Config.useConfig()
  const es = AWS.ES.use({ endpoint: cfg.searchEndpoint, sign: true })

  const data = Data.use(search, { es, buckets, query })

  return data.case({
    _: () => (
      <Alt>
        <Delay alwaysRender>
          {(ready) => (
            <M.Fade in={ready}>
              <M.Box display="flex" alignItems="center">
                <M.Box pr={2}>
                  <M.CircularProgress size={24} />
                </M.Box>
                <M.Typography variant="body1">
                  Searching {displaySelectedBuckets(buckets)} for &quot;{query}&quot;
                </M.Typography>
              </M.Box>
            </M.Fade>
          )}
        </Delay>
      </Alt>
    ),
    Err: () => (
      <Alt>
        <Message headline="Server Error">
          Something went wrong.
          <br />
          <br />
          <M.Button onClick={data.fetch} color="primary" variant="contained">
            Retry
          </M.Button>
        </Message>
      </Alt>
    ),
    Ok: ({ total, hits }) =>
      total ? (
        <Hits {...{ hits, page, scrollRef, makePageUrl }} />
      ) : (
        <Alt>
          <M.Typography variant="body1">
            We have not found anything matching your query
          </M.Typography>
        </Alt>
      ),
  })
}

const displaySelectedBuckets = (buckets) => {
  if (!buckets.length) return 'all buckets'
  if (buckets.length === 1) return `s3://${buckets[0]}`
  return `${buckets.length} buckets`
}

const useQueryInputStyles = M.makeStyles((t) => ({
  searchIcon: {
    left: 8,
    pointerEvents: 'none',
    position: 'absolute',
  },
  input: {
    paddingLeft: t.spacing(5),
    paddingRight: t.spacing(1),
    paddingBottom: 11,
    paddingTop: 10,
    [t.breakpoints.down('xs')]: {
      paddingBottom: 15,
      paddingTop: 14,
    },
  },
}))

function QueryInput({ query, buckets, onChange }) {
  const classes = useQueryInputStyles()
  const state = useEditableValue(query, onChange)

  const handleChange = React.useCallback(
    (e) => {
      state.change(e.target.value)
    },
    [state.change],
  )

  const handleKeyDown = React.useCallback(
    (e) => {
      // eslint-disable-next-line default-case
      switch (e.key) {
        case 'Enter':
          // suppress onSubmit (didn't actually find this to be a problem tho)
          e.preventDefault()
          state.commit()
          e.target.blur()
          break
        case 'Escape':
          e.target.blur()
          break
      }
    },
    [state.commit],
  )

  const t = M.useTheme()
  const xs = M.useMediaQuery(t.breakpoints.down('xs'))
  const placeholder = xs ? `Search ${displaySelectedBuckets(buckets)}` : 'Search'

  return (
    <M.InputBase
      value={state.value}
      onFocus={state.edit}
      onBlur={state.cancel}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      classes={{ input: classes.input }}
      fullWidth
      startAdornment={<M.Icon className={classes.searchIcon}>search</M.Icon>}
    />
  )
}

const useBucketSelectDropdownStyles = M.makeStyles((t) => ({
  select: {
    paddingTop: 10,
    paddingBottom: 11,
    paddingLeft: 12,
    '&:hover': {
      backgroundColor: t.palette.action.hover,
    },
  },
  icon: {
    right: 4,
  },
  root: {
    paddingBottom: t.spacing(1),
    paddingLeft: t.spacing(1.5),
    paddingTop: t.spacing(1),
    textTransform: 'none',
    ...t.typography.body1,
  },
}))

function BucketSelectDropdown({ buckets, onChange }) {
  const classes = useBucketSelectDropdownStyles()
  const state = useEditableValue(buckets, onChange)

  const cfg = Config.use()
  const options = cfg.federations.filter((b) => b.searchEndpoint === cfg.searchEndpoint)

  const t = M.useTheme()
  const xs = M.useMediaQuery(t.breakpoints.down('xs'))

  const anchorRef = React.useRef(null)

  const handleSelect = (v) => () => {
    state.change(
      R.ifElse(
        R.includes(v),
        R.without([v]),
        R.pipe(
          R.append(v),
          R.sortBy(R.identity),
        ),
      )(state.value),
    )
  }

  const selectAll = React.useCallback(() => {
    state.commitValue([])
  }, [state.commitValue])

  return (
    <>
      {xs ? (
        <M.IconButton onClick={state.edit} ref={anchorRef}>
          <M.Icon>menu</M.Icon>
        </M.IconButton>
      ) : (
        <M.Button onClick={state.edit} className={classes.root} ref={anchorRef}>
          <span>
            Searching{' '}
            <M.Box component="span" fontWeight="fontWeightMedium">
              {displaySelectedBuckets(state.value)}
            </M.Box>
          </span>
          <M.Icon>expand_more</M.Icon>
        </M.Button>
      )}
      <M.Menu
        anchorEl={anchorRef.current}
        open={state.edited}
        onClose={state.commit}
        MenuListProps={{ dense: true }}
      >
        <M.MenuItem disabled>
          <M.ListItemText primary="Select buckets to search" />
        </M.MenuItem>
        <M.MenuItem selected={!state.value.length} onClick={selectAll}>
          <M.ListItemIcon>
            <M.Checkbox checked={!state.value.length} edge="start" />
          </M.ListItemIcon>
          <M.ListItemText primary="All buckets" />
        </M.MenuItem>
        {options.map((o) => (
          <M.MenuItem
            key={o.name}
            onClick={handleSelect(o.name)}
            selected={state.value.includes(o.name)}
          >
            <M.ListItemIcon>
              <M.Checkbox checked={state.value.includes(o.name)} edge="start" />
            </M.ListItemIcon>
            <M.ListItemText primary={o.title} secondary={`s3://${o.name}`} />
          </M.MenuItem>
        ))}
      </M.Menu>
    </>
  )
}

const useSearchStyles = M.makeStyles((t) => ({
  paper: {
    [t.breakpoints.down('xs')]: {
      borderRadius: 0,
      boxShadow: 'none',
      '&:first-child': {
        paddingLeft: t.spacing(0.5),
      },
      '&:last-child': {
        paddingRight: t.spacing(0.5),
      },
    },
  },
}))

export default function Search({ location: l }) {
  const classes = useSearchStyles()

  const params = parseSearch(l.search)
  const { q, p } = params
  const buckets = params.buckets ? params.buckets.split(',').sort() : []
  const page = p && parseInt(p, 10)

  const scrollRef = React.useRef(null)

  const { urls } = NamedRoutes.use()
  const dispatch = redux.useDispatch()

  const handleQueryChange = React.useCallback(
    (newQuery) => {
      dispatch(
        push(urls.search({ q: newQuery, buckets: buckets.join(',') || undefined })),
      )
    },
    [buckets, dispatch],
  )

  const handleBucketsChange = React.useCallback(
    (newBuckets) => {
      dispatch(push(urls.search({ q, buckets: newBuckets.join(',') || undefined })))
    },
    [q, dispatch],
  )

  const makePageUrl = React.useCallback(
    (newP) =>
      urls.search({
        q,
        buckets: buckets.join(',') || undefined,
        p: newP !== 1 ? newP : undefined,
      }),
    [q, buckets],
  )

  return (
    <Layout
      pre={
        <M.Container maxWidth="lg">
          <M.Box pb={{ xs: 0, sm: 5 }} mx={{ xs: -2, sm: 0 }}>
            <M.Box display="flex" mt={{ xs: 0, sm: 3 }} ref={scrollRef}>
              <M.Box
                component={M.Paper}
                className={classes.paper}
                flexGrow={{ xs: 1, sm: 0 }}
                position="relative"
              >
                <QueryInput
                  query={q || ''}
                  buckets={buckets}
                  onChange={handleQueryChange}
                />
              </M.Box>
              <M.Box flexGrow={1} display={{ xs: 'none', sm: 'block' }} />
              <M.Box component={M.Paper} className={classes.paper}>
                <BucketSelectDropdown buckets={buckets} onChange={handleBucketsChange} />
              </M.Box>
            </M.Box>
            {q ? (
              <Results {...{ query: q, buckets, page, scrollRef, makePageUrl }} />
            ) : (
              <div>TODO: some help text or smth</div>
            )}
          </M.Box>
        </M.Container>
      }
    />
  )
}
