import * as React from 'react'
import * as M from '@material-ui/core'

import * as Filters from 'components/Filters'

import * as SearchUIModel from './model'

const VALUES = [SearchUIModel.ResultType.QuiltPackage, SearchUIModel.ResultType.S3Object]

const LABELS = {
  [SearchUIModel.ResultType.QuiltPackage]: 'Quilt Packages',
  [SearchUIModel.ResultType.S3Object]: 'S3 Objects',
}

const getLabel = (value: SearchUIModel.ResultType) => LABELS[value]

export default function ResultType() {
  const model = SearchUIModel.use()
  return (
    <M.FormControl variant="outlined" size="small">
      <M.InputLabel>Search for</M.InputLabel>
      <Filters.Select
        extents={VALUES}
        getOptionLabel={getLabel}
        labelWidth={100}
        onChange={model.actions.setResultType}
        value={model.state.resultType}
      />
    </M.FormControl>
  )
}
