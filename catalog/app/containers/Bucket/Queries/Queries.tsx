import * as R from 'ramda'
import * as React from 'react'
import { RouteComponentProps } from 'react-router'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import { docs } from 'constants/urls'
import StyledLink from 'utils/StyledLink'

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

interface SearchResultsFetcherProps {
  children: (
    props: requests.AsyncData<requests.ElasticSearchResults>,
  ) => React.ReactElement
  queryBody: requests.ElasticSearchQuery
}

function SearchResultsFetcher({ children, queryBody }: SearchResultsFetcherProps) {
  const resultsData = requests.useSearch(queryBody)
  return children(resultsData)
}

interface QueryFetcherProps {
  children: (props: requests.AsyncData<requests.ElasticSearchQuery>) => React.ReactElement
  query: requests.Query | null
}

function QueryFetcher({ children, query }: QueryFetcherProps) {
  const queryUrl = React.useMemo(() => (query ? query.url : ''), [query])
  const queryData = requests.useQuery(queryUrl)
  return children(queryData)
}

interface QueriesStatePropsInjectProps {
  queries: requests.Query[]
  handleChange: (q: requests.Query | null) => void
  handleSubmit: (q: requests.ElasticSearchQuery) => () => void
  query: requests.Query | null
  queryData: requests.AsyncData<requests.ElasticSearchQuery>
  resultsData: requests.AsyncData<requests.ElasticSearchResults>
}

interface QueriesStateProps {
  bucket: string
  children: (props: QueriesStatePropsInjectProps) => React.ReactElement
}

function NoQueries() {
  return (
    <M.Box pt={5} textAlign="center">
      <M.Typography variant="h4">No queries</M.Typography>
      <M.Box pt={2} />
      <M.Typography>
        Add queries to config according to{' '}
        <StyledLink href={`${docs}`} target="_blank">
          documentation
        </StyledLink>
        .
      </M.Typography>
    </M.Box>
  )
}

function QueriesState({ bucket, children }: QueriesStateProps) {
  const config: requests.AsyncData<requests.Query[]> = requests.useQueriesConfig(bucket)

  const [selectedQuery, setSelectedQuery] = React.useState<requests.Query | null>(null)
  const [queryBody, setQueryBody] = React.useState<requests.ElasticSearchQuery>(null)

  const handleSubmit = React.useMemo(
    () => (body: requests.ElasticSearchQuery) => () => setQueryBody(body),
    [setQueryBody],
  )

  return config.case({
    Ok: (queries: requests.Query[]) => (
      <QueryFetcher query={selectedQuery || queries[0]}>
        {(queryData) => (
          <SearchResultsFetcher queryBody={queryBody}>
            {(resultsData) =>
              children({
                queries,
                handleChange: setSelectedQuery,
                handleSubmit,
                query: selectedQuery || queries[0],
                queryData,
                resultsData,
              })
            }
          </SearchResultsFetcher>
        )}
      </QueryFetcher>
    ),
    Err: (error: Error) => <Lab.Alert severity="error">{error.message}</Lab.Alert>,
    _: () => <M.CircularProgress size={48} />,
  })
}

export default function Queries({
  match: {
    params: { bucket },
  },
}: RouteComponentProps<{ bucket: string }>) {
  const classes = useStyles()

  const isButtonDisabled = (
    queryContent: requests.ElasticSearchQuery,
    resultsData: requests.AsyncData<requests.ElasticSearchResults>,
  ): boolean =>
    !queryContent || !!resultsData.case({ _: R.T, Init: R.F, Err: R.F, Ok: R.F })

  return (
    <QueriesState bucket={bucket}>
      {({ queries, queryData, handleChange, handleSubmit, query, resultsData }) =>
        queries.length ? (
          <M.Container className={classes.container} maxWidth="lg">
            <M.Typography variant="h6">Elastic Search queries</M.Typography>

            <M.Grid container className={classes.inner}>
              <M.Grid item sm={4} xs={12} className={classes.form}>
                <QuerySelect
                  className={classes.select}
                  queries={queries}
                  onChange={handleChange}
                  value={query}
                />

                {queryData.case({
                  Ok: (queryContent: requests.ElasticSearchQuery) => (
                    <>
                      <QueryViewer query={queryContent} className={classes.viewer} />

                      <div className={classes.actions}>
                        <M.Button
                          variant="contained"
                          color="primary"
                          disabled={isButtonDisabled(queryContent, resultsData)}
                          onClick={handleSubmit(queryContent)}
                        >
                          Run query
                        </M.Button>
                      </div>
                    </>
                  ),
                  Err: (error: Error) => (
                    <Lab.Alert severity="error">{error.message}</Lab.Alert>
                  ),
                  _: () => <M.CircularProgress size={96} />,
                })}
              </M.Grid>

              <M.Grid item sm={8} xs={12}>
                {resultsData.case({
                  Init: () => null,
                  Ok: (results: requests.ElasticSearchResults) => (
                    <QueryResult className={classes.results} results={results} />
                  ),
                  Err: (error: Error) => (
                    <Lab.Alert severity="error">{error.message}</Lab.Alert>
                  ),
                  _: () => (
                    <M.Box pt={5} textAlign="center">
                      <M.CircularProgress size={96} />
                    </M.Box>
                  ),
                })}
              </M.Grid>
            </M.Grid>
          </M.Container>
        ) : (
          <NoQueries />
        )
      }
    </QueriesState>
  )
}
