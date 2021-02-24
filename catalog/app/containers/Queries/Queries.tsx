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

export default function Queries() {
  const classes = useStyles()

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
    <Layout>
      <QueryConfigFetcher>
        {({ configLoading, initialQuery, queriesConfig }) => (
          <>
            <QuerySelect
              className={classes.select}
              loading={configLoading}
              queriesConfig={queriesConfig}
              value={query || initialQuery}
              onChange={handleQuery}
            />

            <SearchResultsFetcher queryBody={queryBody}>
              {({ results, resultsLoading }) => (
                <>
                  <QueryFetcher query={query || initialQuery}>
                    {({ queryContent, queryLoading }) => (
                      <>
                        <QueryViewer loading={queryLoading} value={queryContent} />

                        <div className={classes.actions}>
                          <M.Button
                            disabled={resultsLoading || !queryContent}
                            onClick={handleSubmit(queryContent)}
                          >
                            Run query
                          </M.Button>
                        </div>
                      </>
                    )}
                  </QueryFetcher>

                  <QueryResult loading={resultsLoading} value={results} />
                </>
              )}
            </SearchResultsFetcher>
          </>
        )}
      </QueryConfigFetcher>
    </Layout>
  )
}
