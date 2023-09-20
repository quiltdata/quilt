import * as React from 'react'

import * as Filters from 'components/Filters'

import * as SearchUIModel from './model'

const typeExtents = [
  {
    value: '' as const, // TODO: rename to 'any' or null
    title: 'Packages and objects',
  },
  {
    value: SearchUIModel.ResultType.QuiltPackage,
    title: 'Packages',
  },
  {
    value: SearchUIModel.ResultType.S3Object,
    title: 'Objects',
  },
]

export default function ResultType() {
  const model = SearchUIModel.use()
  const value = typeExtents.find((e) => e.value === model.state.resultType) || null
  return (
    <Filters.Container defaultExpanded title="Result type">
      <Filters.Select<(typeof typeExtents)[0]>
        extents={typeExtents}
        getOptionLabel={(option) => option.title}
        onChange={(o) => model.actions.setResultType(o.value || null)}
        value={value}
      />
    </Filters.Container>
  )
}
