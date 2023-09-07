import * as React from 'react'
import * as M from '@material-ui/core'

import Layout from 'components/Layout'
// import * as SearchResults from 'components/SearchResults'
// import * as BucketConfig from 'utils/BucketConfig'
import * as GQL from 'utils/GraphQL'
import MetaTitle from 'utils/MetaTitle'
import assertNever from 'utils/assertNever'

import * as SearchUIModel from './model'

interface FilterWidgetProps {
  path: SearchUIModel.FacetPath
}

function FilterWidget({ path, ...rest }: FilterWidgetProps) {
  // switch on facet type
  return (
    <div>
      <div>{path}</div>
      <div>{rest}</div>
    </div>
  )
}

function FacetWidget({ name, type, ...rest }: SearchUIModel.ActiveFacet) {
  // actions: deactivate, adjust
  // TODO: facet query (request extents if required)
  return (
    <div>
      <div>{name}</div>
      <div>{rest.path}</div>
      <FilterWidget {...rest} />
    </div>
  )
}

function ActiveFacets() {
  const model = SearchUIModel.use()
  return (
    <>
      {model.state.activeFacets.map((facet, i) => (
        <FacetWidget key={i} {...facet} />
      ))}
    </>
  )
}

function AvailableFacet({ name, path }: SearchUIModel.AvailableFacet) {
  const model = SearchUIModel.use()
  return (
    <button onClick={() => model.actions.activateFacet(path)}>
      {name}
      {path}
    </button>
  )
}

function AvailableFacets() {
  const model = SearchUIModel.use()
  return (
    <>
      {model.state.availableFacets.facets.map((facet, i) => (
        // TODO: infer unique key
        <AvailableFacet key={i} {...facet} />
      ))}
    </>
  )
}

function Filters() {
  return (
    <div>
      <h1>filter by</h1>
      <ActiveFacets />
      <AvailableFacets />
    </div>
  )
}

// interface ResultsPageProps {
//   loadMore?: number
// }
//
// function ResultsPage({ loadMore }: ResultsPageProps) {
//   // const model = SearchUIModel.use()
//   // const [moreLoaded, setMore] = React.useState(false)
//   return (
//     <div>
//       <div>hits</div>
//       {moreLoaded ? (
//         // next page
//         <ResultsPage />
//       ) : (
//         <button>load more</button>
//       )}
//     </div>
//   )
// }
//
// function NextPage() {
//   // const page = SearchUIModel.useNextPage()
//   // render next pages recursively
//   return <ResultsPage loadMore={1} />
// }

function FirstPage() {
  // const firstPage = SearchUIModel.useFirstPage()
  return <div>first page</div>
}

interface ResultsBoundedProps {
  total: number
}

function ResultsBounded({ total }: ResultsBoundedProps) {
  const model = SearchUIModel.use()
  // action: change sort order
  // action: load more
  return (
    <div>
      <div>{total} results</div>
      <div>sort order: {model.state.order}</div>
      <div>
        <FirstPage />
      </div>
    </div>
  )
}

function ResultsUnbounded() {
  return <p>Specify search criteria</p>
}

function Results() {
  const model = SearchUIModel.use()
  return GQL.fold(model.baseSearchQuery, {
    data: ({ search: r }) => {
      switch (r.__typename) {
        case 'BoundedSearch':
          return <ResultsBounded total={r.results.total} />
        case 'UnboundedSearch':
          return <ResultsUnbounded />
        case 'InvalidInput':
          return <p>invalid input: {r.errors[0].message}</p>
        case 'OperationError':
          return <p>operation error: {r.message}</p>
        default:
          assertNever(r)
      }
    },
    fetching: () => <p>loading...</p>,
    error: (err) => {
      // eslint-disable-next-line no-console
      console.error(err)
      return <p>gql error: {err.message}</p>
    },
  })
}

function SearchLayout() {
  const model = SearchUIModel.use()
  return (
    <Layout
      pre={
        <M.Container maxWidth="lg">
          <MetaTitle>{model.state.searchString || 'Search'}</MetaTitle>
          <Filters />
          <Results />
        </M.Container>
      }
    />
  )
}

export default function Search() {
  return (
    <SearchUIModel.Provider>
      <SearchLayout />
    </SearchUIModel.Provider>
  )
}
