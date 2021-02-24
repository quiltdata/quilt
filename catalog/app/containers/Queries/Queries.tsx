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

type ElasticSearchQuery = object | null

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
  queriesList: requests.Query[]
}

interface QueryConfigFetcherProps {
  children: (props: QueryConfigFetcherInjectProps) => React.ReactElement
}

function QueryConfigFetcher({ children }: QueryConfigFetcherProps) {
  const { loading: configLoading, result: queriesConfig } = requests.useQueriesConfig()

  const queriesList = React.useMemo(() => {
    if (!queriesConfig || !queriesConfig.queries) return []
    return Object.entries(queriesConfig.queries).map(([key, query]) => ({
      ...query,
      body: null,
      key,
    }))
  }, [queriesConfig])

  return children({
    configLoading,
    queriesList,
  })
}

interface QueriesStatePropsInjectProps {
  configLoading: boolean
  handleChange: (q: requests.Query | null) => void
  handleSubmit: (q: ElasticSearchQuery) => () => void
  queriesList: requests.Query[]
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
  const [selectedQuery, setSelectedQuery] = React.useState<requests.Query | null>(null)
  const [queryBody, setQueryBody] = React.useState<ElasticSearchQuery>(null)

  const handleSubmit = React.useMemo(
    () => (body: ElasticSearchQuery) => () => setQueryBody(body),
    [setQueryBody],
  )

  return (
    <QueryConfigFetcher>
      {({ configLoading, queriesList }) => (
        <SearchResultsFetcher queryBody={queryBody}>
          {({ results, resultsLoading }) => (
            <QueryFetcher query={selectedQuery || queriesList[0]}>
              {({ queryContent, queryLoading }) =>
                children({
                  configLoading,
                  handleChange: setSelectedQuery,
                  handleSubmit,
                  queriesList,
                  query: selectedQuery || queriesList[0],
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
        handleChange,
        handleSubmit,
        queriesList,
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
            queriesList={queriesList}
            value={query}
            onChange={handleChange}
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
