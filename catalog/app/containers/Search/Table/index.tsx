import * as React from 'react'
import * as M from '@material-ui/core'

import * as Layout from 'components/Layout'
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
          determinate={!!results.determinate}
        />
      )}
    </div>
  )
}

interface TablePageProps {
  className?: string
  bucket?: string
  emptySlot: JSX.Element
  onRefine: (action: NoResults.Refine) => void
}

export default function TablePage({
  className,
  bucket,
  emptySlot,
  onRefine,
}: TablePageProps) {
  Layout.useSetFullWidth()
  const model = SearchUIModel.use(SearchUIModel.ResultType.QuiltPackage)
  const [results, loadMore] = useResults()
  switch (results._tag) {
    case 'idle':
      return null
    case 'in-progress':
      return <NoResults.Skeleton className={className} state={model.state} />
    case 'fail':
      const { error, _tag: tag } = results.error
      switch (tag) {
        case 'general':
        case 'page':
          return (
            <NoResults.UnexpectedError className={className} onRefine={onRefine}>
              {error.message}
            </NoResults.UnexpectedError>
          )
        case 'data':
          switch (error.name) {
            case 'QuerySyntaxError':
              return (
                <NoResults.SyntaxError className={className} onRefine={onRefine}>
                  <>
                    {/* @ts-expect-error */}
                    Invalid input at <code>{error.path}</code>: {error.name}
                    <pre style={{ whiteSpace: 'pre-wrap' }}>{error.message}</pre>
                  </>
                </NoResults.SyntaxError>
              )
            case 'Timeout':
              return <NoResults.TimeoutError className={className} onRefine={onRefine} />
            default:
              return (
                <NoResults.UnexpectedError className={className} onRefine={onRefine}>
                  {error.message}
                </NoResults.UnexpectedError>
              )
          }
        default:
          assertNever(error)
      }
    case 'empty':
      return emptySlot
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
