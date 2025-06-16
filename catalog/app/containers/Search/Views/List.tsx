import * as React from 'react'

import assertNever from 'utils/assertNever'

import * as Hit from '../Hit'
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

export interface ListViewProps {
  hits: readonly SearchUIModel.SearchHit[]
  singleBucket: boolean
  latestOnly: boolean
}

export function ListView({ hits, singleBucket, latestOnly }: ListViewProps) {
  return (
    <>
      {hits.map((hit) => (
        <SearchHit
          key={hit.id}
          hit={hit}
          showBucket={!singleBucket}
          showRevision={!latestOnly}
        />
      ))}
    </>
  )
}
