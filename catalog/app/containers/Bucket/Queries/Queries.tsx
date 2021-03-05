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
  },
  container: {
    padding: t.spacing(3),
  },
  inner: {
    margin: t.spacing(2, 0, 0),
  },
  form: {
    margin: t.spacing(0, 0, 4),
  },
  select: {
    margin: t.spacing(3, 0),
  },
  viewer: {
    margin: t.spacing(3, 0),
  },
}))

interface SearchResultsFetcherProps {
  children: (
    props: requests.AsyncData<requests.ElasticSearchResults>,
  ) => React.ReactElement
  queryBody: requests.ElasticSearchQuery | string
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
  const queryData = requests.useQuery(query ? query.url : '')
  return children(queryData)
}

interface QueriesStatePropsRenderProps {
  customQueryBody: requests.ElasticSearchQuery | string
  error: Error | null
  handleError: (error: Error | null) => void
  handleQueryBodyChange: (q: requests.ElasticSearchQuery | null) => void
  handleQueryMetaChange: (q: requests.Query | null) => void
  handleSubmit: (q: requests.ElasticSearchQuery | string) => () => void
  queries: requests.Query[]
  queryData: requests.AsyncData<requests.ElasticSearchQuery>
  queryMeta: requests.Query | null
  resultsData: requests.AsyncData<requests.ElasticSearchResults>
}

interface QueriesStateProps {
  bucket: string
  children: (props: QueriesStatePropsRenderProps) => React.ReactElement
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
  const classes = useStyles()

  const config: requests.AsyncData<requests.Query[]> = requests.useQueriesConfig(bucket)

  // Info about query: name, url, etc.
  const [queryMeta, setQueryMeta] = React.useState<requests.Query | null>(null)

  // Custom query content, not associated with queryMeta
  const [customQueryBody, setCustomQueryBody] = React.useState<
    requests.ElasticSearchQuery | string
  >(null)

  // Query content requested to Elastic Search
  const [queryRequest, setQueryRequest] = React.useState<
    requests.ElasticSearchQuery | string
  >(null)

  const [error, setError] = React.useState<Error | null>(null)

  const handleSubmit = React.useMemo(
    () => (body: requests.ElasticSearchQuery | string) => () => setQueryRequest(body),
    [setQueryRequest],
  )

  const handleQueryMetaChange = React.useCallback((q: requests.Query | null) => {
    setQueryMeta(q)
    setCustomQueryBody(null)
  }, [])

  return config.case({
    Ok: (queries: requests.Query[]) => (
      <QueryFetcher query={queryMeta || queries[0]}>
        {(queryData) => (
          <SearchResultsFetcher queryBody={queryRequest}>
            {(resultsData) =>
              children({
                customQueryBody,
                error,
                handleError: setError,
                handleQueryBodyChange: setCustomQueryBody,
                handleQueryMetaChange,
                handleSubmit,
                queries,
                queryData,
                queryMeta: queryMeta || queries[0],
                resultsData,
              })
            }
          </SearchResultsFetcher>
        )}
      </QueryFetcher>
    ),
    Err: (requestError: Error) => (
      <M.Container className={classes.container} maxWidth="lg">
        <Lab.Alert severity="error">{requestError.message}</Lab.Alert>
      </M.Container>
    ),
    _: () => (
      <M.Container className={classes.container} maxWidth="lg">
        <M.CircularProgress size={48} />
      </M.Container>
    ),
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
    error: Error | null,
  ): boolean =>
    !!error ||
    !queryContent ||
    !!resultsData.case({ Pending: R.T, _: R.F })

  return (
    <QueriesState bucket={bucket}>
      {({
        customQueryBody,
        error: queryBodyError,
        handleError,
        handleQueryBodyChange,
        handleQueryMetaChange,
        handleSubmit,
        queries,
        queryData,
        queryMeta,
        resultsData,
      }) =>
        queries.length ? (
          <M.Container className={classes.container} maxWidth="lg">
            <M.Typography variant="h6">ElasticSearch queries</M.Typography>

            <QuerySelect
              className={classes.select}
              queries={queries}
              onChange={handleQueryMetaChange}
              value={customQueryBody ? null : queryMeta}
            />

            {queryData.case({
              Ok: (queryBody: requests.ElasticSearchQuery) => (
                <div className={classes.form}>
                  <QueryViewer
                    query={customQueryBody || queryBody}
                    className={classes.viewer}
                    onChange={handleQueryBodyChange}
                    onError={handleError}
                  />

                  <div className={classes.actions}>
                    <M.Button
                      variant="contained"
                      color="primary"
                      disabled={isButtonDisabled(queryBody, resultsData, queryBodyError)}
                      onClick={handleSubmit(customQueryBody || queryBody)}
                    >
                      Run query
                    </M.Button>
                  </div>
                </div>
              ),
              Err: (error: Error) => (
                <Lab.Alert severity="error">{error.message}</Lab.Alert>
              ),
              _: () => <M.CircularProgress size={96} />,
            })}

            {resultsData.case({
              Init: () => null,
              Ok: (results: requests.ElasticSearchResults) => (
                <QueryResult results={results} />
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
          </M.Container>
        ) : (
          <NoQueries />
        )
      }
    </QueriesState>
  )
}
