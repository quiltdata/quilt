import * as React from 'react'
import * as M from '@material-ui/core'

import Layout from 'components/Layout'

import QueryResult from './QueryResult'
import QuerySelect from './QuerySelect'
import QueryViewer from './QueryViewer'
import result from './result.json'
import * as requests from './requests'

const useStyles = M.makeStyles((t) => ({
  actions: {
    margin: t.spacing(1, 0),
  },
}))

export default function Queries() {
  const classes = useStyles()

  const [query, setQuery] = React.useState<requests.Query | null>(null)

  const { loading: configLoading, queriesList } = requests.useQueriesConfig()

  React.useEffect(() => {
    if (!queriesList || !queriesList.length) return
    setQuery(queriesList[0])
  }, [queriesList, setQuery])

  const handleQuery = React.useCallback(() => {
    setQuery(query)
  }, [query, setQuery])

  return (
    <Layout>
      <QuerySelect
        loading={configLoading}
        queries={queriesList || []}
        value={query ? query.key : ''}
        onChange={handleQuery}
      />

      {!!(query && query.content) && <QueryViewer value={query.content} />}

      <div className={classes.actions}>
        <M.Button>Run query</M.Button>
      </div>

      {false && <QueryResult loading={!queriesList} value={result} />}
    </Layout>
  )
}
