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
  container: {
    padding: t.spacing(3),
  },
  inner: {
    margin: t.spacing(2, 0, 0),
  },
  form: {
    margin: t.spacing(0, 0, 2),
  },
  results: {
    [t.breakpoints.up('sm')]: {
      margin: t.spacing(0, 0, 0, 4),
    },
  },
  select: {
    margin: t.spacing(0, 0, 2),
  },
  viewer: {
    margin: t.spacing(2, 0),
  },
}))

type ElasticSearchQuery = object | null

interface SearchResultsFetcherProps {
  children: (props: requests.ResultsData) => React.ReactElement
  queryBody: object | null
}

function SearchResultsFetcher({ children, queryBody }: SearchResultsFetcherProps) {
  const resultsData = requests.useSearch(queryBody)
  return children(resultsData)
}

interface QueryFetcherProps {
  children: (props: requests.QueryData) => React.ReactElement
  query: requests.Query | null
}

function QueryFetcher({ children, query }: QueryFetcherProps) {
  const queryUrl = React.useMemo(() => (query ? query.url : ''), [query])
  const queryData = requests.useQuery(queryUrl)
  return children(queryData)
}

interface QueryConfigFetcherProps {
  children: (props: requests.ConfigData) => React.ReactElement
}

function QueryConfigFetcher({ children }: QueryConfigFetcherProps) {
  const config = requests.useQueriesConfig()
  return children(config)
}

interface QueriesStatePropsInjectProps {
  config: requests.ConfigData
  handleChange: (q: requests.Query | null) => void
  handleSubmit: (q: ElasticSearchQuery) => () => void
  query: requests.Query | null
  queryData: requests.QueryData
  resultsData: requests.ResultsData
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
      {(config) => (
        <SearchResultsFetcher queryBody={queryBody}>
          {(resultsData) => (
            <QueryFetcher query={selectedQuery || config.value[0]}>
              {(queryData) =>
                children({
                  config,
                  handleChange: setSelectedQuery,
                  handleSubmit,
                  query: selectedQuery || config.value[0],
                  queryData,
                  resultsData,
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

  // TODO: use M.Grid, and make one column for narrow screens
  return (
    <QueriesState>
      {({ config, queryData, handleChange, handleSubmit, query, resultsData }) => (
        <Layout
          pre={
            <M.Container className={classes.container} maxWidth="lg">
              <M.Typography variant="h6">Elastic Search queries</M.Typography>

              <M.Grid container className={classes.inner}>
                <M.Grid item sm={4} xs={12} className={classes.form}>
                  <QuerySelect
                    className={classes.select}
                    config={config}
                    onChange={handleChange}
                    value={query}
                  />

                  <QueryViewer query={queryData} className={classes.viewer} />

                  <div className={classes.actions}>
                    <M.Button
                      variant="contained"
                      color="primary"
                      disabled={resultsData.loading || !queryData.value}
                      onClick={handleSubmit(queryData.value)}
                    >
                      Run query
                    </M.Button>
                  </div>
                </M.Grid>

                <M.Grid item sm={8} xs={12}>
                  <QueryResult className={classes.results} results={resultsData} />
                </M.Grid>
              </M.Grid>
            </M.Container>
          }
        />
      )}
    </QueriesState>
  )
}
