import { push } from 'connected-react-router/esm/immutable'
import * as React from 'react'
import * as redux from 'react-redux'
// import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import Layout from 'components/Layout'
import Message from 'components/Message'
import * as Pagination from 'components/Pagination'
import * as SearchResults from 'components/SearchResults'
import Working from 'components/Working'
import * as AWS from 'utils/AWS'
import * as Config from 'utils/Config'
import * as Data from 'utils/Data'
import * as NamedRoutes from 'utils/NamedRoutes'
import parseSearch from 'utils/parseSearch'
import search from 'utils/search'
import useEditableValue from 'utils/useEditableValue'

const PER_PAGE = 10

function Browse() {
  // const { urls } = NamedRoutes.use()
  // TODO: figure out placeholder link / text
  return (
    // <M.Button component={Link} to={urls.bucketRoot(bucket)} variant="outlined">
    <M.Button>Browse smth</M.Button>
  )
}

// TODO: pagination via query param
function Results({ buckets, query, page, scrollRef }) {
  const cfg = Config.useConfig()
  const es = AWS.ES.use({ endpoint: cfg.searchEndpoint, sign: true })
  const scroll = React.useCallback((prev) => {
    if (prev && scrollRef.current) scrollRef.current.scrollIntoView()
  })

  const data = Data.use(search, { es, buckets, query })

  return data.case({
    // TODO: better progress
    _: () => <Working>Searching</Working>,
    Err: () => (
      <Message headline="Server Error">
        Something went wrong.
        <br />
        <br />
        <M.Button onClick={data.fetch} color="primary" variant="contained">
          Retry
        </M.Button>
      </Message>
    ),
    Ok: ({ total, hits }) => (
      <>
        <M.Box mb={2} mt={1}>
          <M.Typography variant="h5">
            {total
              ? `Search results for "${query}" (${total} hits, ${hits.length} files)`
              : `Nothing found for "${query}"`}
          </M.Typography>
        </M.Box>
        {total ? (
          <Pagination.Paginate items={hits} onChange={scroll}>
            {({ paginated, ...props }) => (
              <>
                {paginated.map((hit) => (
                  <SearchResults.Hit key={hit.path} hit={hit} showBucket />
                ))}
                {props.pages > 1 && (
                  <M.Box mt={2}>
                    <Pagination.Controls {...props} />
                  </M.Box>
                )}
              </>
            )}
          </Pagination.Paginate>
        ) : (
          <>
            <M.Typography variant="body1">
              We have not found anything matching your query
            </M.Typography>
            <br />
            <Browse />
          </>
        )}
      </>
    ),
  })
}

function useSearchInputState(query, onSearch) {
  const state = useEditableValue(query, onSearch)
  return {
    value: state.value,
    onFocus: state.edit,
    onBlur: state.cancel,
    onChange: React.useCallback((e) => state.change(e.target.value), [state.change]),
    onKeyDown: React.useCallback(
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
    ),
  }
}

const ALL = '__ALL__'

function useBucketSelectState(buckets, onBucketSelect) {
  const state = useEditableValue(buckets, onBucketSelect)
  return {
    value: state.value,
    open: state.edited,
    onOpen: state.edit,
    onClose: state.commit,
    onChange: React.useCallback(
      ({ target: { value } }) => {
        if (value.includes(ALL)) {
          state.commitValue([])
        } else {
          state.change(value.slice().sort())
        }
      },
      [state.change, state.commitValue],
    ),
  }
}

const useSearchStyles = M.makeStyles((t) => ({
  paper: {
    [t.breakpoints.down('xs')]: {
      borderRadius: 0,
      boxShadow: 'none',
    },
  },
  searchIcon: {
    left: 8,
    pointerEvents: 'none',
    position: 'absolute',
  },
  input: {
    paddingLeft: t.spacing(5),
    paddingRight: t.spacing(5),
    paddingBottom: 11,
    paddingTop: 10,
    [t.breakpoints.down('xs')]: {
      paddingBottom: 15,
      paddingTop: 14,
    },
  },
}))

export default function Search({ location: l }) {
  const classes = useSearchStyles()

  const params = parseSearch(l.search)
  const { q, p } = params
  const buckets = params.buckets ? params.buckets.split(',').sort() : []

  const scrollRef = React.useRef(null)

  const bucketOptions = Config.useFederations()

  const { urls } = NamedRoutes.use()
  const dispatch = redux.useDispatch()

  const searchState = useSearchInputState(
    q || '',
    React.useCallback(
      (newQuery) => {
        dispatch(
          push(urls.search({ q: newQuery, buckets: buckets.join(',') || undefined })),
        )
      },
      [buckets, dispatch],
    ),
  )

  const bucketSelectState = useBucketSelectState(
    buckets,
    React.useCallback(
      (newBuckets) => {
        dispatch(push(urls.search({ q, buckets: newBuckets.join(',') || undefined })))
      },
      [q, dispatch],
    ),
  )

  const t = M.useTheme()
  const xs = M.useMediaQuery(t.breakpoints.down('xs'))

  return (
    <Layout
      pre={
        <M.Container maxWidth="lg">
          <M.Box pb={xs ? 0 : 5} mx={xs ? -2 : 0}>
            <M.Box display="flex" mt={{ xs: 0, sm: 3 }} ref={scrollRef}>
              <M.Box
                component={M.Paper}
                className={classes.paper}
                flexGrow={{ xs: 1, sm: 0 }}
                position="relative"
              >
                <M.InputBase
                  {...searchState}
                  placeholder={`Search ${buckets ? buckets.length : 'all'} buckets`}
                  classes={{ input: classes.input }}
                  fullWidth
                  startAdornment={<M.Icon className={classes.searchIcon}>search</M.Icon>}
                />
              </M.Box>
              <M.Box flexGrow={1} display={{ xs: 'none', sm: 'block' }} />
              <M.Box component={M.Paper} className={classes.paper}>
                <M.Select
                  multiple
                  displayEmpty
                  {...bucketSelectState}
                  input={<M.InputBase />}
                  renderValue={(v) => {
                    if (!v.length) return 'All'
                    if (v.length === 1) return `s3://${v[0]}`
                    return `${v.length} buckets`
                  }}
                >
                  <M.MenuItem key="_placeholder" value="" disabled>
                    <M.ListItemText primary="Select buckets to search in" />
                  </M.MenuItem>
                  <M.MenuItem key="_all" value={ALL}>
                    <M.ListItemText primary="All" />
                  </M.MenuItem>
                  {bucketOptions.map((o) => (
                    <M.MenuItem
                      key={o.name}
                      value={o.name}
                      dense
                      selected={bucketSelectState.value.includes(o.name)}
                    >
                      <M.Checkbox checked={bucketSelectState.value.includes(o.name)} />
                      <M.ListItemText primary={o.title} secondary={`s3://${o.name}`} />
                    </M.MenuItem>
                  ))}
                </M.Select>
              </M.Box>
            </M.Box>

            {q ? (
              <Results {...{ query: q, buckets, page: p, scrollRef }} />
            ) : (
              <div>TODO: some help text or smth</div>
            )}
          </M.Box>
        </M.Container>
      }
    />
  )
}
