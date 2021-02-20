import * as React from 'react'
import * as M from '@material-ui/core'

import Layout from 'components/Layout'
import * as AWS from 'utils/AWS'

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

  const [configLoading, setConfigLoading] = React.useState(false)

  const [queriesList, setQueriesList] = React.useState<requests.Query[] | null>(null)
  const [query, setQuery] = React.useState<requests.Query | null>(null)

  const s3 = AWS.S3.use()
  React.useEffect(() => {
    setConfigLoading(true)
    requests.queriesConfig({ s3, bucket: 'fiskus-sandbox-dev' }).then((config) => {
      setConfigLoading(false)
      if (!config) return
      const queries = Object.entries(config.queries).map(([key, value]) => ({
        key,
        ...value,
      }))
      if (!queries.length) return
      setQueriesList(queries)
      setQuery(queries[0])
    })
  }, [s3, setConfigLoading, setQueriesList])

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
