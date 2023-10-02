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
  const handleChange = React.useCallback(
    (value: (typeof sortOptions)[number]) => {
      setOrder(value.valueOf())
    },
    [setOrder],
  )
  return (
    <SelectDropdown
      className={className}
      options={sortOptions}
      value={model.state.order}
      onChange={handleChange}
      ButtonProps={ButtonProps}
    />
  )
}
