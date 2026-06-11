import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import { CloseOnClick } from 'components/Buttons'

import { EmptySlot, ErrorSlot } from 'containers/Bucket/Successors'
import * as Request from 'utils/useRequest'
import * as workflows from 'utils/workflows'

const LIST_ITEM_TYPOGRAPHY_PROPS = { noWrap: true }

const useStyles = M.makeStyles((t) => ({
  root: {
    minWidth: t.spacing(40),
  },
}))

interface CreatePackageOptionsProps {
  onChange: (x: workflows.Successor) => void
  successors: Request.Result<workflows.Successor[]>
}

export default function CreatePackageOptions({
  onChange,
  successors,
}: CreatePackageOptionsProps) {
  const classes = useStyles()
  if (successors === Request.Idle) return null

  if (successors instanceof Error) {
    return (
      <div className={classes.root}>
        <ErrorSlot error={successors} />
      </div>
    )
  }

  if (successors === Request.Loading) {
    return (
      <M.List dense className={classes.root}>
        <M.ListItem>
          <M.ListItemText primary={<Lab.Skeleton />} secondary={<Lab.Skeleton />} />
        </M.ListItem>
        <M.ListItem>
          <M.ListItemText primary={<Lab.Skeleton />} secondary={<Lab.Skeleton />} />
        </M.ListItem>
        <M.ListItem>
          <M.ListItemText primary={<Lab.Skeleton />} secondary={<Lab.Skeleton />} />
        </M.ListItem>
      </M.List>
    )
  }

  if (!successors.length) {
    return (
      <div className={classes.root}>
        <EmptySlot />
      </div>
    )
  }

  return (
    <CloseOnClick>
      <M.List dense className={classes.root}>
        {successors.map((successor) => (
          <M.ListItem key={successor.slug} onClick={() => onChange(successor)} button>
            <M.ListItemText
              primary={successor.name}
              primaryTypographyProps={LIST_ITEM_TYPOGRAPHY_PROPS}
              secondary={successor.url}
              secondaryTypographyProps={LIST_ITEM_TYPOGRAPHY_PROPS}
            />
          </M.ListItem>
        ))}
      </M.List>
    </CloseOnClick>
  )
}
