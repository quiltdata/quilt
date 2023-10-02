import * as React from 'react'

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
    <Filters.Container defaultExpanded title="Search for">
      <Filters.Select
        extents={VALUES}
        getOptionLabel={getLabel}
        onChange={model.actions.setResultType}
        value={model.state.resultType}
      />
    </Filters.Container>
  )
}
