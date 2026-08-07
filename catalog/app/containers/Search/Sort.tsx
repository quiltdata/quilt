import * as React from 'react'
import * as M from '@material-ui/core'

import SelectDropdown from 'components/SelectDropdown'
import * as GQL from 'utils/GraphQL'
import assertNever from 'utils/assertNever'

import * as SearchUIModel from './model'

// The preset "Sort by" options, as ordering expressions (model.PRESET_ORDERINGS).
// `valueOf` returns the ordering expression (or null for relevance); the
// SelectDropdown matches options by strict `valueOf()` equality.
const sortOptions = SearchUIModel.PRESET_ORDERINGS.map((preset) => ({
  toString: () => preset.label,
  valueOf: () => preset.ordering,
}))

// Shown when the active ordering is not one of the presets — i.e. a per-column
// field sort or a user-metadata pointer sort set from a table column header (see
// Table/Table.tsx). The dropdown must not advertise a preset that is not in
// effect; picking any preset here overwrites the ordering and takes over again.
const columnSortOption = {
  toString: () => 'Column',
  valueOf: () => null,
}

const useButtonStyles = M.makeStyles((t) => ({
  root: {
    background: t.palette.background.paper,
  },
}))

const useStyles = M.makeStyles((t) => ({
  value: {
    fontWeight: t.typography.fontWeightMedium,
    marginLeft: t.spacing(0.5),
  },
}))

interface SortProps {
  className: string
}

export default function Sort({ className }: SortProps) {
  const classes = useStyles()
  const buttonClasses = useButtonStyles()
  const t = M.useTheme()
  const sm = M.useMediaQuery(t.breakpoints.down('sm'))
  const model = SearchUIModel.use()
  const { setOrdering } = model.actions
  // A non-preset ordering (a column/pointer field sort) has no dropdown label;
  // surface it as "Column" rather than falling back to a preset not in effect.
  const value = React.useMemo(
    () =>
      sortOptions.find(({ valueOf }) => valueOf() === model.state.ordering) ||
      (model.state.ordering ? columnSortOption : sortOptions[0]),
    [model.state.ordering],
  )
  const handleChange = React.useCallback(
    (v: { valueOf: () => SearchUIModel.Ordering }) => {
      setOrdering(v.valueOf())
    },
    [setOrdering],
  )

  const visible = GQL.fold(model.baseSearchQuery, {
    data: (data, { fetching }) => {
      if (fetching) return false
      const r =
        model.state.resultType === SearchUIModel.ResultType.QuiltPackage
          ? data.searchPackages
          : data.searchObjects
      switch (r.__typename) {
        case 'EmptySearchResultSet':
        case 'InvalidInput':
        case 'OperationError':
          return false
        case 'ObjectsSearchResultSet':
        case 'PackagesSearchResultSet':
          return true
        default:
          assertNever(r)
      }
    },
    fetching: () => false,
    error: () => false,
  })

  if (!visible) return null

  return (
    <SelectDropdown
      className={className}
      classes={classes}
      options={sortOptions}
      value={value}
      onChange={handleChange}
      ButtonProps={{ classes: buttonClasses, size: 'medium' }}
      shrink={sm}
    >
      {sm ? <M.Icon>sort</M.Icon> : 'Sort by:'}
    </SelectDropdown>
  )
}
