import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import QuerySelect from './QuerySelect'
import AthenaQueryViewer from './AthenaQueryViewer'
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

interface QueriesStatePropsRenderProps {
  queries: requests.AthenaQuery[]
}

interface QueriesStateProps {
  bucket: string
  children: (props: QueriesStatePropsRenderProps) => React.ReactElement
}

function QueriesState({ bucket, children }: QueriesStateProps) {
  const classes = useStyles()
  const data = requests.useNamedQueries(bucket)
  return data.case({
    Ok: (queries: requests.AthenaQuery[]) =>
      children({
        queries,
      }),
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

// const isButtonDisabled = (
//   queryContent: string,
//   resultsData: requests.AsyncData<requests.ElasticSearchResults>,
//   error: Error | null,
// ): boolean => !!error || !queryContent || !!resultsData.case({ Pending: R.T, _: R.F })

interface AthenaProps {
  bucket: string
  className: string
}

export default function Athena({ bucket, className }: AthenaProps) {
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
  const [queryRequest, setQueryRequest] = React.useState<requests.ElasticSearchQuery>(
    null,
  )

  // eslint-disable-next-line no-console
  console.log({ queryRequest })

  const handleSubmit = React.useMemo(
    () => (body: string) => () => setQueryRequest(body),
    [setQueryRequest],
  )

  return (
    <QueriesState bucket={bucket}>
      {({ queries }) => (
        <div className={className}>
          <M.Typography variant="h6">Athena SQL {bucket}</M.Typography>

          <QuerySelect
            className={classes.select}
            queries={queries}
            onChange={handleQueryMetaChange}
            value={customQueryBody ? null : queryMeta}
          />

          <Form
            disabled={false}
            onChange={setCustomQueryBody}
            onSubmit={handleSubmit}
            value={customQueryBody || queryMeta?.body || ''}
          />
        </div>
      )}
    </QueriesState>
  )
}
