import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import AthenaQueryViewer from './AthenaQueryViewer'
import QueryResult from './QueryResult'
import QuerySelect from './QuerySelect'
import WorkgroupSelect from './WorkgroupSelect'
import * as requests from './requests'

const useStyles = M.makeStyles((t) => ({
  actions: {
    margin: t.spacing(2, 0),
  },
  container: {
    display: 'flex',
    padding: t.spacing(3),
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

interface FormProps {
  disabled: boolean
  onChange: (value: string) => void
  onSubmit: (value: string) => () => void
  value: string | null
}

function Form({ disabled, value, onChange, onSubmit }: FormProps) {
  const classes = useStyles()

  return (
    <div className={classes.form}>
      <AthenaQueryViewer
        className={classes.viewer}
        onChange={onChange}
        query={value || ''}
      />

      <div className={classes.actions}>
        <M.Button
          variant="contained"
          color="primary"
          disabled={disabled}
          onClick={onSubmit(value || '')}
        >
          Run query
        </M.Button>
      </div>
    </div>
  )
}

interface SearchResultsFetcherProps {
  children: (
    props: requests.AsyncData<requests.AthenaSearchResults>,
  ) => React.ReactElement
  queryBody: string
  workgroup: string
}

function SearchResultsFetcher({
  children,
  queryBody,
  workgroup,
}: SearchResultsFetcherProps) {
  const resultsData = requests.useAthenaSearch(workgroup, queryBody)
  return children(resultsData)
}

interface QueriesFetcherProps {
  children: (props: requests.AsyncData<requests.AthenaQuery[]>) => React.ReactElement
  workgroup: string
}

function QueriesFetcher({ children, workgroup }: QueriesFetcherProps) {
  const queries = requests.useNamedQueries(workgroup)
  return children(queries)
}

interface QueriesStatePropsRenderProps {
  customQueryBody: string | null
  handleWorkgroupChange: (w: requests.Workgroup | null) => void
  handleQueryBodyChange: (q: string | null) => void
  handleQueryMetaChange: (q: requests.Query | requests.AthenaQuery | null) => void
  handleSubmit: (q: string) => () => void
  queriesData: requests.AsyncData<requests.AthenaQuery[]>
  queryMeta: requests.AthenaQuery | null
  resultsData: requests.AsyncData<requests.AthenaSearchResults>
  workgroup: requests.Workgroup | null
  workgroups: requests.Workgroup[]
}

interface QueriesStateProps {
  children: (props: QueriesStatePropsRenderProps) => React.ReactElement
}

function QueriesState({ children }: QueriesStateProps) {
  const classes = useStyles()

  // Info about query: name, url, etc.
  const [queryMeta, setQueryMeta] = React.useState<requests.AthenaQuery | null>(null)

  // Custom query content, not associated with queryMeta
  const [customQueryBody, setCustomQueryBody] = React.useState<string | null>(null)

  const handleQueryMetaChange = React.useCallback(
    (query) => {
      setQueryMeta(query as requests.AthenaQuery | null)
      setCustomQueryBody(null)
    },
    [setQueryMeta, setCustomQueryBody],
  )

  // Query content requested to Elastic Search
  const [queryRequest, setQueryRequest] = React.useState<string | null>(null)

  const handleSubmit = React.useMemo(
    () => (body: string) => () => setQueryRequest(body),
    [setQueryRequest],
  )

  const workgroupsData = requests.useAthenaWorkgroups()

  const [workgroup, setWorkgroup] = React.useState<requests.Workgroup | null>(null)
  const handleWorkgroupChange = React.useCallback(
    (w) => {
      setWorkgroup(w)
    },
    [setWorkgroup],
  )

  return workgroupsData.case({
    Ok: (workgroups) => (
      <QueriesFetcher workgroup={workgroup?.name || workgroups?.[0].name || ''}>
        {(queriesData) => (
          <SearchResultsFetcher
            queryBody={queryRequest || ''}
            workgroup={workgroup?.name || workgroups?.[0].name || ''}
          >
            {(resultsData) =>
              children({
                customQueryBody,
                handleWorkgroupChange,
                handleQueryBodyChange: setCustomQueryBody,
                handleQueryMetaChange,
                handleSubmit,
                queriesData,
                queryMeta,
                resultsData,
                workgroup: workgroup || workgroups?.[0],
                workgroups,
              })
            }
          </SearchResultsFetcher>
        )}
      </QueriesFetcher>
    ),
    Err: (requestError: Error) => (
      <div className={classes.container}>
        <Lab.Alert severity="error">{requestError.message}</Lab.Alert>
      </div>
    ),
    _: () => (
      <div className={classes.container}>
        <M.CircularProgress size={48} />
      </div>
    ),
  })
}

const isButtonDisabled = (
  queryContent: string,
  resultsData: requests.AsyncData<requests.ElasticSearchResults>,
  error: Error | null,
): boolean => !!error || !queryContent || !!resultsData.case({ Pending: R.T, _: R.F })

interface AthenaProps {
  className: string
}

export default function Athena({ className }: AthenaProps) {
  const classes = useStyles()

  return (
    <QueriesState>
      {({
        customQueryBody,
        handleQueryBodyChange,
        handleQueryMetaChange,
        handleSubmit,
        handleWorkgroupChange,
        queriesData,
        queryMeta,
        resultsData,
        workgroup,
        workgroups,
      }) => (
        <div className={className}>
          <M.Typography variant="h6">Athena SQL</M.Typography>
          <WorkgroupSelect
            className={classes.select}
            workgroups={workgroups}
            onChange={handleWorkgroupChange}
            value={workgroup}
          />

          {queriesData.case({
            Ok: (queries) => (
              <QuerySelect
                className={classes.select}
                queries={queries}
                onChange={handleQueryMetaChange}
                value={customQueryBody ? null : queryMeta}
              />
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

          <Form
            disabled={isButtonDisabled(
              customQueryBody || queryMeta?.body || '',
              resultsData,
              null,
            )}
            onChange={handleQueryBodyChange}
            onSubmit={handleSubmit}
            value={customQueryBody || queryMeta?.body || ''}
          />

          {resultsData.case({
            Init: () => null,
            Ok: (results: requests.AthenaSearchResults) => (
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
        </div>
      )}
    </QueriesState>
  )
}
