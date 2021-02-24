import * as React from 'react'
import * as M from '@material-ui/core'

import Layout from 'components/Layout'

import QueryResult from './QueryResult'
import QuerySelect from './QuerySelect'
import QueryViewer from './QueryViewer'
import * as requests from './requests'

const useStyles = M.makeStyles((t) => ({
  actions: {
    margin: t.spacing(1, 0),
  },
  select: {
    margin: t.spacing(0, 0, 2),
    maxWidth: t.spacing(60),
  },
}))

interface SearchResultsFetcherInjectProps {
  resultsLoading: boolean
  results: object | null
}

interface SearchResultsFetcherProps {
  children: (props: SearchResultsFetcherInjectProps) => React.ReactElement
  queryBody: object | null
}

function SearchResultsFetcher({ children, queryBody }: SearchResultsFetcherProps) {
  const { loading: resultsLoading, result: results } = requests.useSearch(queryBody)
  return children({
    resultsLoading,
    results,
  })
}

interface QueryFetcherInjectProps {
  queryLoading: boolean
  queryContent: object | null
}

interface QueryFetcherProps {
  children: (props: QueryFetcherInjectProps) => React.ReactElement
  query: requests.Query | null
}

function QueryFetcher({ children, query }: QueryFetcherProps) {
  const queryUrl = React.useMemo(() => (query ? query.url : ''), [query])
  const { loading: queryLoading, result: queryContent } = requests.useQuery(queryUrl)
  return children({
    queryLoading,
    queryContent,
  })
}

interface QueryConfigFetcherInjectProps {
  configLoading: boolean
  initialQuery: requests.Query | null
  queriesConfig: requests.Config | null
}

interface QueryConfigFetcherProps {
  children: (props: QueryConfigFetcherInjectProps) => React.ReactElement
}

function QueryConfigFetcher({ children }: QueryConfigFetcherProps) {
  const { loading: configLoading, result: queriesConfig } = requests.useQueriesConfig()

  const initialQuery = React.useMemo(() => {
    if (!queriesConfig || !queriesConfig.queries) return null
    const [key, value] = Object.entries(queriesConfig.queries)[0]
    return {
      key,
      ...value,
    }
  }, [queriesConfig])

  return children({
    configLoading,
    initialQuery,
    queriesConfig,
  })
}

interface QueriesStatePropsInjectProps {
  configLoading: boolean
  handleQuery: (q: requests.Query) => void
  handleSubmit: (q: object | null) => () => void
  initialQuery: requests.Query | null
  queriesConfig: requests.Config | null
  query: requests.Query | null
  queryContent: object | null
  queryLoading: boolean
  results: object | null
  resultsLoading: boolean
}

interface QueriesStateProps {
  children: (props: QueriesStatePropsInjectProps) => React.ReactElement
}
function QueriesState({ children }: QueriesStateProps) {
  const [query, setQuery] = React.useState<requests.Query | null>(null)
  const [queryBody, setQueryBody] = React.useState<object | null>(null)

  const handleSubmit = React.useMemo(
    () => (queryContent: object | null) => () => {
      setQueryBody(queryContent)
    },
    [setQueryBody],
  )

  const handleQuery = React.useCallback(
    (newQuery: requests.Query) => {
      setQuery(newQuery)
      setQueryBody(null)
    },
    [setQuery, setQueryBody],
  )

  return (
    <QueryConfigFetcher>
      {({ configLoading, initialQuery, queriesConfig }) => (
        <SearchResultsFetcher queryBody={queryBody}>
          {({ results, resultsLoading }) => (
            <QueryFetcher query={query || initialQuery}>
              {({ queryContent, queryLoading }) =>
                children({
                  configLoading,
                  handleQuery,
                  handleSubmit,
                  initialQuery,
                  queriesConfig,
                  query,
                  queryContent,
                  queryLoading,
                  results,
                  resultsLoading,
                })
              }
            </QueryFetcher>
          )}
        </SearchResultsFetcher>
      )}
    </QueryConfigFetcher>
  )
}

export default function Queries() {
  const classes = useStyles()

  return (
    <QueriesState>
      {({
        configLoading,
        handleQuery,
        handleSubmit,
        initialQuery,
        queriesConfig,
        query,
        queryContent,
        queryLoading,
        results,
        resultsLoading,
      }) => (
        <Layout>
          <QuerySelect
            className={classes.select}
            loading={configLoading}
            queriesConfig={queriesConfig}
            value={query || initialQuery}
            onChange={handleQuery}
          />

          <QueryViewer loading={queryLoading} value={queryContent} />

          <div className={classes.actions}>
            <M.Button
              disabled={resultsLoading || !queryContent}
              onClick={handleSubmit(queryContent)}
            >
              Run query
            </M.Button>
          </div>

          <QueryResult loading={resultsLoading} value={results} />
        </Layout>
      )}
    </QueriesState>
  )
}
