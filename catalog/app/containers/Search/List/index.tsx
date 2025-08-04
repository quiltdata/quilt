import * as React from 'react'
import * as M from '@material-ui/core'

import assertNever from 'utils/assertNever'

import LoadNextPage from '../Layout/LoadNextPage'
import * as NoResults from '../NoResults'
import * as SearchUIModel from '../model'

import * as Hit from './Hit'

interface SearchHitProps {
  hit: SearchUIModel.SearchHit
  showBucket: boolean
  showRevision: boolean
}

function SearchHit({ hit, showBucket, showRevision }: SearchHitProps) {
  switch (hit.__typename) {
    case 'SearchHitObject':
      return (
        <Hit.Object
          showBucket={showBucket}
          hit={hit}
          data-testid="search-hit"
          data-search-hit-type="file"
          data-search-hit-bucket={hit.bucket}
          data-search-hit-path={hit.key}
        />
      )

    case 'SearchHitPackage':
      return (
        <Hit.Package
          showBucket={showBucket}
          showRevision={showRevision}
          hit={hit}
          data-testid="search-hit"
          data-search-hit-type="package"
          data-search-hit-bucket={hit.bucket}
          data-search-hit-package-name={hit.name}
          data-search-hit-package-hash={hit.hash}
        />
      )

    default:
      assertNever(hit)
  }
}

interface NextPageProps {
  after: string
  resultType: SearchUIModel.ResultType
  className: string
  singleBucket: boolean
  latestOnly: boolean
  onRefine: (action: NoResults.Refine) => void
  determinate: boolean
}

function NextPage({
  after,
  className,
  resultType,
  singleBucket,
  latestOnly,
  onRefine,
  determinate,
}: NextPageProps) {
  const NextPageQuery =
    resultType === SearchUIModel.ResultType.S3Object
      ? SearchUIModel.NextPageObjectsQuery
      : SearchUIModel.NextPagePackagesQuery
  return (
    <NextPageQuery after={after}>
      {(r) => {
        switch (r._tag) {
          case 'fetching':
            return (
              <LoadNextPage className={className} loading determinate={determinate} />
            )
          case 'error':
            return (
              <NoResults.Error className={className} onRefine={onRefine}>
                {r.error.message}
              </NoResults.Error>
            )
          case 'data':
            switch (r.data.__typename) {
              case 'InvalidInput':
                // should not happen
                const [err] = r.data.errors
                return (
                  <NoResults.Error className={className} onRefine={onRefine}>
                    Invalid input at <code>{err.path}</code>: {err.name}
                    <br />
                    {err.message}
                  </NoResults.Error>
                )
              case 'PackagesSearchResultSetPage':
              case 'ObjectsSearchResultSetPage':
                return (
                  <ResultsPage
                    className={className}
                    hits={r.data.hits}
                    cursor={r.data.cursor}
                    resultType={resultType}
                    singleBucket={singleBucket}
                    latestOnly={latestOnly}
                    onRefine={onRefine}
                    determinate={determinate}
                  />
                )
              default:
                assertNever(r.data)
            }
          default:
            assertNever(r)
        }
      }}
    </NextPageQuery>
  )
}

const useResultsPageStyles = M.makeStyles((t) => ({
  emptyPage: {
    marginBottom: t.spacing(1),
  },
  next: {
    marginTop: t.spacing(1),
  },
}))

interface ResultsPageProps {
  className?: string
  cursor: string | null
  hits: readonly SearchUIModel.SearchHit[]
  resultType: SearchUIModel.ResultType
  singleBucket: boolean
  latestOnly: boolean
  onRefine: (action: NoResults.Refine) => void
  determinate: boolean
}

function ResultsPage({
  className,
  hits,
  cursor,
  resultType,
  singleBucket,
  latestOnly,
  onRefine,
  determinate,
}: ResultsPageProps) {
  const classes = useResultsPageStyles()
  const [more, setMore] = React.useState(false)
  const loadMore = React.useCallback(() => {
    setMore(true)
  }, [])

  return (
    <div className={className}>
      {hits.map((hit) => (
        <SearchHit
          key={hit.id}
          hit={hit}
          showBucket={!singleBucket}
          showRevision={!latestOnly}
        />
      ))}
      {!hits.length && (
        <NoResults.SecureSearch
          className={classes.emptyPage}
          onRefine={onRefine}
          onLoadMore={loadMore}
        />
      )}
      {!!cursor &&
        (more ? (
          <NextPage
            after={cursor}
            className={classes.next}
            resultType={resultType}
            singleBucket={singleBucket}
            latestOnly={latestOnly}
            onRefine={onRefine}
            determinate={determinate}
          />
        ) : (
          <LoadNextPage
            className={classes.next}
            onClick={loadMore}
            determinate={determinate}
          />
        ))}
    </div>
  )
}

interface ListResultsProps {
  className?: string
  onRefine: (action: NoResults.Refine) => void
}

export default function ListResults({ className, onRefine }: ListResultsProps) {
  const model = SearchUIModel.use()
  const r = model.firstPageQuery

  switch (r._tag) {
    case 'fetching':
      return <NoResults.Skeleton className={className} state={model.state} />
    case 'error':
      return (
        <NoResults.Error className={className} onRefine={onRefine}>
          {r.error.message}
        </NoResults.Error>
      )
    case 'data':
      switch (r.data.__typename) {
        case 'EmptySearchResultSet':
          return <NoResults.Empty className={className} onRefine={onRefine} />
        case 'InvalidInput':
          const [err] = r.data.errors
          if (err.name === 'QuerySyntaxError') {
            return (
              <NoResults.Error className={className} kind="syntax" onRefine={onRefine}>
                {err.message}
              </NoResults.Error>
            )
          }
          return (
            <NoResults.Error className={className} onRefine={onRefine}>
              Invalid input at <code>{err.path}</code>: {err.name}
              <br />
              {err.message}
            </NoResults.Error>
          )
        case 'ObjectsSearchResultSet':
        case 'PackagesSearchResultSet':
          const latestOnly =
            model.state.resultType === SearchUIModel.ResultType.QuiltPackage
              ? model.state.latestOnly
              : true

          return (
            <ResultsPage
              className={className}
              key={`${model.state.resultType}:${r.data.firstPage.cursor}`}
              resultType={model.state.resultType}
              hits={r.data.firstPage.hits}
              cursor={r.data.firstPage.cursor}
              singleBucket={model.state.buckets.length === 1}
              latestOnly={latestOnly}
              onRefine={onRefine}
              determinate={r.data.total > -1}
            />
          )
        default:
          assertNever(r.data)
      }
    default:
      assertNever(r)
  }
}
