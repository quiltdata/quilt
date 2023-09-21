import * as React from 'react'
import * as M from '@material-ui/core'

import SelectDropdown from 'components/SelectDropdown'
import * as Model from 'model'

import * as SearchUIModel from './model'

const sortOptions = [
  {
    field: Model.GQLTypes.SearchResultOrderField.Relevance,
    direction: Model.GQLTypes.SortDirection.DESC,
    toString: () => 'Relevance',
    valueOf() {
      return this.field + this.direction
    },
  },
  {
    field: Model.GQLTypes.SearchResultOrderField.Modified,
    direction: Model.GQLTypes.SortDirection.DESC,
    toString: () => 'Date modified (newest first)',
    valueOf() {
      return this.field + this.direction
    },
  },
  {
    field: Model.GQLTypes.SearchResultOrderField.Modified,
    direction: Model.GQLTypes.SortDirection.ASC,
    toString: () => 'Date modified (oldest first)',
    valueOf() {
      return this.field + this.direction
    },
  },
  {
    field: Model.GQLTypes.SearchResultOrderField.Size,
    direction: Model.GQLTypes.SortDirection.DESC,
    toString: () => 'Size (highest first)',
    valueOf() {
      return this.field + this.direction
    },
  },
  {
    field: Model.GQLTypes.SearchResultOrderField.Size,
    direction: Model.GQLTypes.SortDirection.ASC,
    toString: () => 'Size (lowest first)',
    valueOf() {
      return this.field + this.direction
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
  const { order } = model.state
  const { setOrder } = model.actions
  const value = React.useMemo(
    () =>
      sortOptions.find(
        ({ field, direction }) => field === order.field && direction === order.direction,
      ) || sortOptions[0],
    [order],
  )
  const handleChange = React.useCallback(
    ({ field, direction }) => {
      setOrder({ field, direction })
    },
    [setOrder],
  )
  const ButtonProps = React.useMemo(
    () => ({
      classes: buttonClasses,
      variant: 'contained' as const,
      size: 'medium' as const,
    }),
    [buttonClasses],
  )
  return (
    <SelectDropdown<(typeof sortOptions)[0]>
      className={className}
      options={sortOptions}
      value={value}
      onChange={handleChange}
      ButtonProps={ButtonProps}
    />
  )
}
