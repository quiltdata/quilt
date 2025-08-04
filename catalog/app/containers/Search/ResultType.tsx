import * as React from 'react'
import * as M from '@material-ui/core'

import * as GQL from 'utils/GraphQL'
import * as SearchUIModel from './model'

const VALUES = [SearchUIModel.ResultType.QuiltPackage, SearchUIModel.ResultType.S3Object]

const LABELS = {
  [SearchUIModel.ResultType.QuiltPackage]: 'Packages',
  [SearchUIModel.ResultType.S3Object]: 'Objects',
}

const getLabel = (value: SearchUIModel.ResultType) => LABELS[value]

const useIconStyles = M.makeStyles({
  pkg: {
    width: '19px',
    height: '19px',
  },
})
interface IconProps {
  resultType: SearchUIModel.ResultType
}

function Icon({ resultType }: IconProps) {
  const classes = useIconStyles()
  if (resultType === SearchUIModel.ResultType.S3Object) {
    return <M.Icon fontSize="small">insert_drive_file</M.Icon>
  }
  return (
    <M.SvgIcon viewBox="-133 0 1264 1008" className={classes.pkg}>
      <path
        fill="currentColor"
        d="M-2 918V446l1004 4v472c0 52-41 93-92 93H91c-52 0-93-43-93-97zM193 3h278v380H0c0-6 0-12 2-16L102 68c14-40 50-65 91-65zm709 63l100 299v2c2 4 2 8 2 12H534V1h277c41 0 77 25 91 65z"
      />
    </M.SvgIcon>
  )
}

const useResultTypeStyles = M.makeStyles((t) => ({
  root: {
    background: t.palette.background.paper,
    border: `1px solid ${M.fade(t.palette.text.primary, 0.23)}`,
    borderRadius: t.shape.borderRadius,
  },
  icon: {
    minWidth: t.spacing(3.5),
  },
  chip: {
    backgroundColor: t.palette.text.hint,
    color: t.palette.getContrastText(t.palette.text.hint),
  },
  item: {
    paddingLeft: t.spacing(1.5),
    paddingRight: t.spacing(1),
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

  const getTotalSelectedResults = () => {
    if (model.firstPageQuery._tag !== 'data') return null
    const d = model.firstPageQuery.data
    switch (d.__typename) {
      case 'ObjectsSearchResultSet':
      case 'PackagesSearchResultSet':
        return d.total
      case 'EmptySearchResultSet':
        return 0
      default:
        return null
    }
  }

  const getTotalOtherResults = (resultType: SearchUIModel.ResultType) =>
    GQL.fold(model.baseSearchQuery, {
      data: (data) => {
        const r =
          resultType === SearchUIModel.ResultType.QuiltPackage
            ? data.searchPackages
            : data.searchObjects
        switch (r.__typename) {
          case 'EmptySearchResultSet':
            return 0
          case 'ObjectsSearchResultSet':
          case 'PackagesSearchResultSet':
            return r.total
          default:
            return null
        }
      },
      fetching: () => null,
      error: () => null,
    })

  return (
    <M.List dense disablePadding className={classes.root}>
      {VALUES.map((v) => {
        const selected = model.state.resultType === v
        const total = selected ? getTotalSelectedResults() : getTotalOtherResults(v)
        return (
          <M.ListItem
            button
            className={classes.item}
            disableGutters
            key={v}
            onClick={() => model.actions.setResultType(v)}
            selected={selected}
          >
            <M.ListItemIcon className={classes.icon}>
              <Icon resultType={v} />
            </M.ListItemIcon>
            <M.ListItemText primary={getLabel(v)} />
            {total != null && total >= 0 && (
              <M.ListItemSecondaryAction>
                <M.Chip className={classes.chip} size="small" label={total} />
              </M.ListItemSecondaryAction>
            )}
          </M.ListItem>
        )
      })}
    </M.List>
  )
}
