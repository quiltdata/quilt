import Fuse from 'fuse.js'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as Filters from 'components/Filters'
import * as JSONPointer from 'utils/JSONPointer'

import * as SearchUIModel from './model'

function pathToChipTitle(path: SearchUIModel.FacetPath) {
  const [head, ...tail] = path
  switch (head) {
    case 'pkg':
      switch (tail[0]) {
        case 'total_size':
          return 'Total size'
        case 'total_entries':
          return 'Total entries'
      }
    case 'pkg_meta':
      return (
        <>
          Package meta has <b>{tail.slice(0, -1).join(' ')}</b> {tail.slice(-1)}
        </>
      )
    default:
      return JSONPointer.stringify(path as string[])
  }
}

function fuzzySearchFacets(
  facets: SearchUIModel.KnownFacetDescriptor[],
  searchStr: string,
): SearchUIModel.KnownFacetDescriptor[] {
  if (!searchStr) return facets
  const fuse = new Fuse(facets, {
    includeScore: true,
    keys: ['path'],
    getFn: (facet) => facet.path.join(''),
  })
  return fuse
    .search(searchStr)
    .sort((a, b) => (a.score || Infinity) - (b.score || Infinity))
    .map(({ item }) => item)
}

const useStyles = M.makeStyles((t) => ({
  header: {
    margin: t.spacing(0, 0, 0.5),
  },
  input: {
    marginBottom: t.spacing(1),
  },
}))

interface AvailableFacetsProps {
  className: string
}

export default function AvailableFacets({ className }: AvailableFacetsProps) {
  const classes = useStyles()
  const model = SearchUIModel.use()
  const [search, setSearch] = React.useState('')
  const items = React.useMemo(
    () =>
      fuzzySearchFacets(model.state.availableFacets.facets, search).map(({ path }) => ({
        label: pathToChipTitle(path),
        onClick: () => model.actions.activateFacet(path),
      })),
    [model.state.availableFacets.facets, model.actions, search],
  )
  const hiddenNumber = model.state.availableFacets.facets.length - items.length
  return (
    <div className={className}>
      <M.Typography variant="subtitle2" className={classes.header}>
        Available filters
      </M.Typography>
      <Filters.TinyTextField
        className={classes.input}
        fullWidth
        onChange={setSearch}
        placeholder="Search filters"
        value={search}
      />
      <Filters.Chips items={items} />
      {!!hiddenNumber && (
        <M.Typography variant="caption">
          {items.length
            ? `There are ${hiddenNumber} more filters available. Loosen search query to see more.`
            : `${hiddenNumber} available filters are hidden. Clear filters to see them.`}
        </M.Typography>
      )}
    </div>
  )
}
