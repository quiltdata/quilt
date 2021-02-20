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

  const { loading: configLoading, result: queriesConfig } = requests.useQueriesConfig()

  const { loading: queryLoading, result: queryContent } = requests.useQuery(
    query ? query.url : '',
  )

  React.useEffect(() => {
    if (!queriesConfig || !queriesConfig.queries) return
    const [key, value] = Object.entries(queriesConfig.queries)[0]
    setQuery({
      key,
      ...value,
    })
  }, [queriesConfig, setQuery])

  const handleQuery = React.useCallback(
    (querySlug: string) => {
      if (!queriesConfig) return
      setQuery({
        key: querySlug,
        ...queriesConfig.queries[querySlug],
      })
    },
    [queriesConfig, setQuery],
  )

  return (
    <Layout>
      <QuerySelect
        loading={configLoading}
        queriesConfig={queriesConfig}
        value={query}
        onChange={handleQuery}
      />

      <QueryViewer loading={queryLoading} value={queryContent} />

      <div className={classes.actions}>
        <M.Button>Run query</M.Button>
      </div>

      {false && <QueryResult loading={!queriesConfig} value={result} />}
    </Layout>
  )
}
