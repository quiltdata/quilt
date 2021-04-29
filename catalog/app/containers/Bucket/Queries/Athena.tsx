import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import QuerySelect from './QuerySelect'
import * as requests from './requests'

const useStyles = M.makeStyles((t) => ({
  container: {
    display: 'flex',
    padding: t.spacing(3),
  },
  select: {
    margin: t.spacing(3, 0),
  },
}))

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
        </div>
      )}
    </QueriesState>
  )
}
