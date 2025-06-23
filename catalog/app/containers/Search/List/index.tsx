import * as React from 'react'
import * as M from '@material-ui/core'

import assertNever from 'utils/assertNever'

import * as Hit from '../Hit'

import LoadNextPage from '../LoadNextPage'
import * as NoResults from '../NoResults'
import * as SearchUIModel from '../model'

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
}

function NextPage({
  after,
  className,
  resultType,
  singleBucket,
  latestOnly,
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
            return <LoadNextPage className={className} loading />
          case 'error':
            return <NoResults.Error className={className} details={r.error.message} />
          case 'data':
            switch (r.data.__typename) {
              case 'InvalidInput':
                // should not happen
                const [err] = r.data.errors
                const details = (
                  <>
                    Invalid input at <code>{err.path}</code>: {err.name}
                    <br />
                    {err.message}
                  </>
                )
                return <NoResults.Error className={className} details={details} />
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
}

function ResultsPage({
  className,
  hits,
  cursor,
  resultType,
  singleBucket,
  latestOnly,
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
      {!!cursor &&
        (more ? (
          <NextPage
            after={cursor}
            className={classes.next}
            resultType={resultType}
            singleBucket={singleBucket}
            latestOnly={latestOnly}
          />
        ) : (
          <LoadNextPage className={classes.next} onClick={loadMore} />
        ))}
    </div>
  )
}

interface ListResultsProps {
  className?: string
}

export default function ListResults({ className }: ListResultsProps) {
  const model = SearchUIModel.use()
  const r = model.firstPageQuery

  switch (r._tag) {
    case 'fetching':
      return <NoResults.Skeleton className={className} type={model.state.resultType} />
    case 'error':
      return <NoResults.Error className={className} details={r.error.message} />
    case 'data':
      switch (r.data.__typename) {
        case 'EmptySearchResultSet':
          return <NoResults.Empty className={className} />
        case 'InvalidInput':
          const [err] = r.data.errors
          const kind = err.name === 'QuerySyntaxError' ? 'syntax' : 'unexpected'
          const details =
            err.name === 'QuerySyntaxError' ? (
              err.message
            ) : (
              <>
                Invalid input at <code>{err.path}</code>: {err.name}
                <br />
                {err.message}
              </>
            )
          return <NoResults.Error className={className} kind={kind} details={details} />
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
            />
          )
        default:
          assertNever(r.data)
      }
    default:
      assertNever(r)
  }
}
