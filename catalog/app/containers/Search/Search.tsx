import * as R from 'ramda'
import * as React from 'react'
import { Link, useHistory } from 'react-router-dom'
import * as RR from 'react-router-dom'
import * as M from '@material-ui/core'

import Layout from 'components/Layout'
import * as SearchResults from 'components/SearchResults'
import * as BucketConfig from 'utils/BucketConfig'
import * as Data from 'utils/Data'
import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'
import parseSearch from 'utils/parseSearch'
import useSearch from 'utils/search'
import useEditableValue from 'utils/useEditableValue'

const TYPE_OBJECTS = 'objects'
const TYPE_PACKAGES = 'packages'
const TYPES = [TYPE_OBJECTS, TYPE_PACKAGES, undefined] as const
type SearchType = (typeof TYPES)[number]

function parseSearchType(x: any): SearchType {
  return TYPES.includes(x) ? x : undefined
}

interface SearchUrlState {
  type: SearchType
  buckets: string[]
  query: string
  page: number
  retry?: number
  // facets???
}

// XXX: use io-ts or smth for morphisms between url (querystring) and search state
// XXX: split state into "global" (type, buckets) and "per-query" (query, page, retry)?
function useUrlState(): SearchUrlState {
  const l = RR.useLocation()
  // XXX: support legacy "mode" param (convert to "type")
  const params = React.useMemo(() => parseSearch(l.search, true), [l.search])
  const type = parseSearchType(params.type)
  const buckets = React.useMemo(
    () => (params.buckets ? params.buckets.split(',').sort() : []),
    [params.buckets],
  )
  const query = params.query || ''
  const page = params.p ? parseInt(params.p, 10) : 1
  const retry = (params.retry && parseInt(params.retry, 10)) || undefined
  return React.useMemo(
    () => ({ type, buckets, query, page, retry }),
    [type, buckets, query, page, retry],
  )
}

function useMakeUrl() {
  const { urls } = NamedRoutes.use()
  return React.useCallback(
    (state: SearchUrlState) =>
      urls.search({
        q: state.query,
        buckets: state.buckets.join(',') || undefined,
        type: state.type,
        retry: state.retry,
        p: state.page === 1 ? undefined : state.page,
      }),
    [urls],
  )
}

export default function Search() {
  const { urls } = NamedRoutes.use()
  const history = RR.useHistory()
  // const classes = useSearchStyles()

  const scrollRef = React.useRef(null)

  const makeUrl = useMakeUrl()

  const state = useUrlState()

  const updateUrl = React.useCallback(
    (newState: SearchUrlState) => {
      history.push(makeUrl(newState))
    },
    [history, makeUrl],
  )

  const handleQueryChange = React.useCallback(
    (query: string) => {
      updateUrl({ query, buckets: state.buckets, type: state.type, page: 1 })
    },
    [updateUrl, state.buckets, state.type],
  )

  // XXX: function to transition to a new state?
  const handleBucketsChange = React.useCallback(
    (buckets: string[]) => {
      updateUrl({ query: state.query, buckets, type: state.type, page: 1 })
    },
    [updateUrl, state.query, state.type],
  )

  const handleTypeChange = React.useCallback(
    (type: SearchType) => {
      updateUrl({ query: state.query, buckets: state.buckets, type, page: 1 })
    },
    [updateUrl, state.query, state.buckets],
  )

  const retryUrl = makeUrl({ ...state, retry: (state.retry || 0) + 1 })

  const makePageUrl = React.useCallback(
    (page: number) => makeUrl({ ...state, page }),
    [makeUrl, state],
  )

  const data = Data.use(
    useSearch(),
    { buckets, mode, query: q, retry },
    { noAutoFetch: !q },
  )

  return (
    <Layout
      pre={
        <M.Container maxWidth="lg">
          <MetaTitle>{q || 'Search'}</MetaTitle>
          <M.Box pb={{ xs: 0, sm: 5 }} mx={{ xs: -2, sm: 0 }}>
            <M.Box
              display="flex"
              position="relative"
              mt={{ xs: 0, sm: 3 }}
              ref={scrollRef}
            >
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
              <div className={classes.stats}>{!!q && <SearchStats data={data} />}</div>
              <M.Box component={M.Paper} className={classes.paper}>
                <ModeAndBucketSelector
                  mode={mode}
                  onModeChange={handleTypeChange}
                  buckets={buckets}
                  onBucketsChange={handleBucketsChange}
                />
              </M.Box>
            </M.Box>
            {q ? (
              <Results
                {...{
                  data,
                  query: q,
                  buckets,
                  page,
                  scrollRef,
                  makePageUrl,
                  retryUrl,
                }}
              />
            ) : (
              // TODO: revise copy
              <SearchResults.Alt>
                <M.Typography variant="body1">Search for anything</M.Typography>
              </SearchResults.Alt>
            )}
          </M.Box>
        </M.Container>
      }
    />
  )
}
