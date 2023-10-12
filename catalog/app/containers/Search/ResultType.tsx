import * as React from 'react'
import * as M from '@material-ui/core'

import * as SearchUIModel from './model'

const VALUES = [SearchUIModel.ResultType.QuiltPackage, SearchUIModel.ResultType.S3Object]

const LABELS = {
  [SearchUIModel.ResultType.QuiltPackage]: 'Quilt Packages',
  [SearchUIModel.ResultType.S3Object]: 'S3 Objects',
}

const getLabel = (value: SearchUIModel.ResultType) => LABELS[value]

const useResultTypeStyles = M.makeStyles((t) => ({
  root: {
    border: `1px solid ${t.palette.divider}`,
    borderRadius: t.shape.borderRadius,
  },
  item: {
    '&:first-child': {
      borderRadius: `${t.shape.borderRadius}px ${t.shape.borderRadius}px 0 0`,
    },
    '&:last-child': {
      borderRadius: `0 0 ${t.shape.borderRadius}px ${t.shape.borderRadius}px`,
    },
  },
}))

export default function ResultType() {
  const classes = useResultTypeStyles()
  const model = SearchUIModel.use()
  return (
    <M.List dense disablePadding className={classes.root}>
      {VALUES.map((v) => {
        const selected = model.state.resultType === v
        return (
          <M.ListItem
            className={classes.item}
            button
            key={v}
            selected={selected}
            onClick={() => model.actions.setResultType(v)}
          >
            <M.ListItemText primary={getLabel(v)} />
          </M.ListItem>
        )
      })}
    </M.List>
  )
}
