import * as React from 'react'
import * as M from '@material-ui/core'

import Layout from 'components/Layout'

import QueryResult from './QueryResult'
import QuerySelect from './QuerySelect'
import QueryViewer from './QueryViewer'
import * as requests from './requests'

const useStyles = M.makeStyles((t) => ({
  actions: {
    margin: t.spacing(2, 0),
    textAlign: 'right',
  },
  layout: {
    padding: t.spacing(3),
  },
  form: {
    margin: t.spacing(0, 0, 2),
    maxWidth: t.spacing(60),
  },
  results: {
    margin: t.spacing(4, 0, 0),
  },
  select: {
    margin: t.spacing(0, 0, 2),
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
  queryContent: object | null
  queryError: Error | null
  queryLoading: boolean
}

interface QueryFetcherProps {
  children: (props: QueryFetcherInjectProps) => React.ReactElement
  query: requests.Query | null
}

function QueryFetcher({ children, query }: QueryFetcherProps) {
  const queryUrl = React.useMemo(() => (query ? query.url : ''), [query])
  const {
    error: queryError,
    loading: queryLoading,
    result: queryContent,
  } = requests.useQuery(queryUrl)
  return children({
    queryContent,
    queryError,
    queryLoading,
  })
}

interface QueryConfigFetcherInjectProps {
  configError: Error | null
  configLoading: boolean
  queriesList: requests.Query[]
}

interface QueryConfigFetcherProps {
  children: (props: QueryConfigFetcherInjectProps) => React.ReactElement
}

function QueryConfigFetcher({ children }: QueryConfigFetcherProps) {
  const {
    error: configError,
    loading: configLoading,
    result: queriesConfig,
  } = requests.useQueriesConfig()

  const queriesList = React.useMemo(() => {
    if (!queriesConfig || queriesConfig instanceof Error || !queriesConfig.queries)
      return []

    return Object.entries(queriesConfig.queries).map(([key, query]) => ({
      ...query,
      body: null,
      key,
    }))
  }, [queriesConfig])

  return children({
    configError,
    configLoading,
    queriesList,
  })
}

interface QueriesStatePropsInjectProps {
  configError: Error | null
  configLoading: boolean
  handleChange: (q: requests.Query | null) => void
  handleSubmit: (q: ElasticSearchQuery) => () => void
  queriesList: requests.Query[]
  query: requests.Query | null
  queryContent: object | null
  queryError: Error | null
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
      {({ configError, configLoading, queriesList }) => (
        <SearchResultsFetcher queryBody={queryBody}>
          {({ results, resultsLoading }) => (
            <QueryFetcher query={selectedQuery || queriesList[0]}>
              {({ queryError, queryContent, queryLoading }) =>
                children({
                  configError,
                  configLoading,
                  handleChange: setSelectedQuery,
                  handleSubmit,
                  queriesList,
                  query: selectedQuery || queriesList[0],
                  queryContent,
                  queryError,
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
        configError,
        configLoading,
        handleChange,
        handleSubmit,
        queriesList,
        query,
        queryContent,
        queryError,
        queryLoading,
        results,
        resultsLoading,
      }) => (
        <Layout
          pre={
            <M.Container className={classes.layout} maxWidth="lg">
              <div className={classes.form}>
                <QuerySelect
                  className={classes.select}
                  error={configError}
                  loading={configLoading}
                  onChange={handleChange}
                  queriesList={queriesList}
                  value={query}
                />

                <QueryViewer
                  error={queryError}
                  loading={queryLoading}
                  value={queryContent}
                />

                <div className={classes.actions}>
                  <M.Button
                    variant="contained"
                    color="primary"
                    disabled={resultsLoading || !queryContent}
                    onClick={handleSubmit(queryContent)}
                  >
                    Run query
                  </M.Button>
                </div>
              </div>

              <QueryResult
                className={classes.results}
                loading={resultsLoading}
                value={results}
              />
            </M.Container>
          }
        />
      )}
    </QueriesState>
  )
}
