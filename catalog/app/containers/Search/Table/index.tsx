import * as React from 'react'
import * as M from '@material-ui/core'

import assertNever from 'utils/assertNever'

import LoadNextPage from '../Layout/LoadNextPage'
import * as NoResults from '../NoResults'
import * as SearchUIModel from '../model'

import Table from './Table'
import { useResults, Results } from './useResults'

const useStyles = M.makeStyles((t) => ({
  next: {
    justifyContent: 'center',
    marginTop: t.spacing(1),
  },
}))

interface ResultsInnerProps {
  className?: string
  results: Extract<Results, { _tag: 'ok' }>
  bucket?: string
  loadMore?: () => void
}

function ResultsInner({ className, results, loadMore, bucket }: ResultsInnerProps) {
  const classes = useStyles()
  return (
    <div className={className}>
      <Table hits={results.hits} bucket={bucket} />
      {loadMore && (
        <LoadNextPage
          className={classes.next}
          loading={results._tag === 'ok' && results.next?._tag === 'in-progress'}
          onClick={loadMore}
        />
      )}
    </div>
  )
}

interface TablePageProps {
  className?: string
  bucket?: string
}

export default function TablePage({ className, bucket }: TablePageProps) {
  const model = SearchUIModel.use(SearchUIModel.ResultType.QuiltPackage)
  const [results, loadMore] = useResults()
  switch (results._tag) {
    case 'idle':
      return null
    case 'in-progress':
      return <NoResults.Skeleton className={className} state={model.state} />
    case 'fail':
      return (
        <NoResults.Error className={className}>{results.error.message}</NoResults.Error>
      )
    case 'empty':
      return <NoResults.Empty className={className} bucket={bucket} />
    case 'ok':
      return (
        <ResultsInner
          bucket={bucket}
          className={className}
          loadMore={loadMore}
          results={results}
        />
      )
    default:
      assertNever(results)
  }
}
