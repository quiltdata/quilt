import * as React from 'react'
import * as M from '@material-ui/core'

import assertNever from 'utils/assertNever'

import * as Views from './Views'
import LoadNextPage from './LoadNextPage'
import * as SearchUIModel from './model'
import { useResults, ResultsOk } from './useResults'

const useStyles = M.makeStyles((t) => ({
  next: {
    marginTop: t.spacing(1),
  },
}))

interface ResultsInnerProps {
  className?: string
  results: ResultsOk
  singleBucket: boolean
  loadMore?: () => void
}

function ResultsInner({ className, results, loadMore, singleBucket }: ResultsInnerProps) {
  const classes = useStyles()
  return (
    <div className={className}>
      <Views.TableView hits={results.hits} singleBucket={singleBucket} />
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
}

export default function TablePage({ className }: TablePageProps) {
  const model = SearchUIModel.use(SearchUIModel.ResultType.QuiltPackage)
  const [results, loadMore] = useResults()
  switch (results._tag) {
    case 'idle':
      return null
    case 'in-progress':
      return <Views.TableSkeleton className={className} />
    case 'fail':
      return (
        <Views.NoResults.Error className={className} details={results.error.message} />
      )
    case 'empty':
      return <Views.NoResults.Empty className={className} />
    case 'ok':
      return (
        <ResultsInner
          className={className}
          results={results}
          loadMore={loadMore}
          singleBucket={model.state.buckets.length === 1}
        />
      )
    default:
      assertNever(results)
  }
}
