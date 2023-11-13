import * as React from 'react'
import * as M from '@material-ui/core'

import * as SearchUIModel from './model'

const VALUES = [SearchUIModel.ResultType.QuiltPackage, SearchUIModel.ResultType.S3Object]

const LABELS = {
  [SearchUIModel.ResultType.QuiltPackage]: 'Quilt Packages',
  [SearchUIModel.ResultType.S3Object]: 'S3 Objects',
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
    border: `1px solid ${M.fade(t.palette.text.primary, 0.23)}`,
    borderRadius: t.shape.borderRadius,
  },
  icon: {
    minWidth: t.spacing(3.5),
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
  return (
    <M.List dense disablePadding className={classes.root}>
      {VALUES.map((v) => {
        const selected = model.state.resultType === v
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
          </M.ListItem>
        )
      })}
    </M.List>
  )
}
