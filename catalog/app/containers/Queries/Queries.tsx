import * as React from 'react'
import * as M from '@material-ui/core'

import Layout from 'components/Layout'

import QueryResult from './QueryResult'
import QuerySelect from './QuerySelect'
import QueryViewer from './QueryViewer'
import * as requests from './requests'

const useStyles = M.makeStyles((t) => ({
  actions: {
    margin: t.spacing(1, 0),
  },
  select: {
    margin: t.spacing(0, 0, 2),
    maxWidth: t.spacing(60),
  },
}))

export default function Queries() {
  const classes = useStyles()

  const [query, setQuery] = React.useState<requests.Query | null>(null)
  const [queryBody, setQueryBody] = React.useState<object | null>(null)

  const { loading: configLoading, result: queriesConfig } = requests.useQueriesConfig()

  const queryUrl = React.useMemo(() => (query ? query.url : ''), [query])
  const { loading: queryLoading, result: queryContent } = requests.useQuery(queryUrl)

  const { loading: resutlsLoading, result: results } = requests.useSearch(queryBody)

  React.useEffect(() => {
    if (!queriesConfig || !queriesConfig.queries) return
    const [key, value] = Object.entries(queriesConfig.queries)[0]
    setQuery({
      key,
      ...value,
    })
  }, [queriesConfig, setQuery])

  const handleSubmit = React.useCallback(() => {
    setQueryBody(queryContent)
  }, [queryContent, setQueryBody])

  const handleQuery = React.useCallback(
    (querySlug: string) => {
      if (!queriesConfig) return
      setQuery({
        key: querySlug,
        ...queriesConfig.queries[querySlug],
      })
      setQueryBody(null)
    },
    [queriesConfig, setQuery],
  )

  return (
    <Layout>
      <QuerySelect
        className={classes.select}
        loading={configLoading}
        queriesConfig={queriesConfig}
        value={query}
        onChange={handleQuery}
      />

      <QueryViewer loading={queryLoading} value={queryContent} />

      <div className={classes.actions}>
        <M.Button disabled={resutlsLoading || !queryContent} onClick={handleSubmit}>
          Run query
        </M.Button>
      </div>

      <QueryResult loading={resutlsLoading} value={results} />
    </Layout>
  )
}
