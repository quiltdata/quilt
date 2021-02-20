import * as React from 'react'
import * as M from '@material-ui/core'

import Layout from 'components/Layout'

import QueryResult from './QueryResult'
import QuerySelect from './QuerySelect'
import QueryViewer from './QueryViewer'
import queriesList from './queries'
import result from './result.json'

const useStyles = M.makeStyles((t) => ({
  actions: {
    margin: t.spacing(1, 0),
  },
}))

export default function Queries() {
  const classes = useStyles()

  const [query, setQuery] = React.useState(queriesList[0])

  const handleQuery = React.useCallback(() => {
    setQuery(query)
  }, [query, setQuery])

  return (
    <Layout>
      <QuerySelect queries={queriesList} value={query.key} onChange={handleQuery} />

      <QueryViewer value={query.content} />

      <div className={classes.actions}>
        <M.Button>Run query</M.Button>
      </div>

      <QueryResult value={result} />
    </Layout>
  )
}
