import * as React from 'react'
import * as M from '@material-ui/core'

import SelectDropdown from 'components/SelectDropdown'
import * as Model from 'model'
import * as GQL from 'utils/GraphQL'
import assertNever from 'utils/assertNever'

import * as SearchUIModel from './model'

const sortOptions = [
  {
    toString: () => 'Best match',
    valueOf() {
      return Model.GQLTypes.SearchResultOrder.BEST_MATCH
    },
  },
  {
    toString: () => 'Most recent first',
    valueOf() {
      return Model.GQLTypes.SearchResultOrder.NEWEST
    },
  },
  {
    toString: () => 'Least recent first',
    valueOf() {
      return Model.GQLTypes.SearchResultOrder.OLDEST
    },
  },
]

const useButtonStyles = M.makeStyles((t) => ({
  root: {
    background: t.palette.background.paper,
    '&:hover': {
      background: t.palette.background.paper,
    },
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
  const { setOrder } = model.actions
  const ButtonProps = React.useMemo(
    () => ({
      classes: buttonClasses,
      variant: 'contained' as const,
      size: 'medium' as const,
    }),
    [buttonClasses],
  )
  const value = React.useMemo(
    () =>
      sortOptions.find(({ valueOf }) => valueOf() === model.state.order) ||
      sortOptions[0],
    [model.state.order],
  )
  const handleChange = React.useCallback(
    (v: (typeof sortOptions)[number]) => {
      setOrder(v.valueOf())
    },
    [setOrder],
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
      ButtonProps={ButtonProps}
    >
      {sm ? <M.Icon>sort</M.Icon> : 'Sort by:'}
    </SelectDropdown>
  )
}
