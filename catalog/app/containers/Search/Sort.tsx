import * as React from 'react'
import * as M from '@material-ui/core'

import SelectDropdown from 'components/SelectDropdown'
import * as Model from 'model'

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

interface SortProps {
  className: string
}

export default function Sort({ className }: SortProps) {
  const buttonClasses = useButtonStyles()
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
  return (
    <SelectDropdown
      className={className}
      options={sortOptions}
      value={value}
      onChange={handleChange}
      ButtonProps={ButtonProps}
    />
  )
}
