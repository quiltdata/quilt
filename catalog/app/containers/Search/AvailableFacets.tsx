// @ts-nocheck
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
      const name = tail.slice(0, -1).join(' ')
      const type = tail.slice(-1)
      return (
        <span title={`${head} ${name} ${type}`}>
          Package meta has <b>{name}</b> {type}
        </span>
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
  facets: SearchUIModel.KnownFacetDescriptor[]
  onActivate: (path: SearchUIModel.FacetPath) => void
}

function AvailableFacets({ className, facets, onActivate }: AvailableFacetsProps) {
  const classes = useStyles()
  const [search, setSearch] = React.useState('')
  const items = React.useMemo(
    () =>
      fuzzySearchFacets(facets, search).map(({ path }) => ({
        label: pathToChipTitle(path),
        onClick: () => onActivate(path),
      })),
    [facets, onActivate, search],
  )

  const hiddenNumber = facets.length - items.length
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

interface AvailableFacetsWrapperProps {
  className: string
}

export default function AvailableFacetsWrapper({
  className,
}: AvailableFacetsWrapperProps) {
  const model = SearchUIModel.use()
  const { facets, fetching } = model.state.availableFacets
  const onActivate = model.actions.activateFacet
  if (fetching) return <Filters.ChipsSkeleton className={className} />
  if (!facets.length) return null
  return <AvailableFacets className={className} facets={facets} onActivate={onActivate} />
}
