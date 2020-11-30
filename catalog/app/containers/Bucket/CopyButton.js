import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import { useData } from 'utils/Data'

import * as requests from './requests'

function MenuPlaceholder() {
  const t = M.useTheme()

  return (
    <M.Box minWidth={t.spacing(22)}>
      <M.MenuItem disabled>
        <Lab.Skeleton height={t.spacing(4)} width="100%" />
      </M.MenuItem>
      <M.MenuItem disabled>
        <Lab.Skeleton height={t.spacing(4)} width="100%" />
      </M.MenuItem>
      <M.MenuItem disabled>
        <Lab.Skeleton height={t.spacing(4)} width="100%" />
      </M.MenuItem>
    </M.Box>
  )
}

function MenuItem({ item, onClick }) {
  return (
    <M.MenuItem onClick={React.useCallback(() => onClick(item), [item, onClick])}>
      <M.ListItemText primary={item.name} secondary={item.url} />
    </M.MenuItem>
  )
}

const BucketsListFetcher = React.forwardRef(({ bucket, children }, ref) => {
  const s3 = AWS.S3.use()
  const data = useData(requests.workflowsList, { s3, bucket })
  const res = data.case({
    Ok: AsyncResult.Ok,
    Err: AsyncResult.Err,
    _: R.identity,
  })
  return children({
    ref,
    ...res,
  })
})

function SuccessorsSelect({ anchorEl, bucket, open, onChange, onClose }) {
  return (
    <M.Menu anchorEl={anchorEl} onClose={onClose} open={open}>
      <BucketsListFetcher bucket={bucket}>
        {AsyncResult.case({
          Ok: ({ successors }) => (
            <>
              {successors.map((b) => (
                <MenuItem key={b.slug} item={b} onClick={onChange} />
              ))}
            </>
          ),
          _: () => <MenuPlaceholder />,
          Err: () => null,
        })}
      </BucketsListFetcher>
    </M.Menu>
  )
}

const useButtonStyles = M.makeStyles(() => ({
  root: {
    flexShrink: 0,
    margin: '-3px 0',
  },
}))

function Button({ children, onClick }) {
  const classes = useButtonStyles()

  return (
    <M.Button
      aria-haspopup="true"
      className={classes.root}
      color="primary"
      size="small"
      startIcon={<M.Icon>arrow_right_alt</M.Icon>}
      variant="outlined"
      onClick={onClick}
    >
      {children}
    </M.Button>
  )
}

export default function CopyButton({ bucket, onChange }) {
  const [menuAnchorEl, setMenuAnchorEl] = React.useState(null)

  const onButtonClick = React.useCallback(
    (event) => setMenuAnchorEl(event.currentTarget),
    [setMenuAnchorEl],
  )

  const onMenuClick = React.useCallback(
    (menuItem) => {
      onChange(menuItem)
      setMenuAnchorEl(null)
    },
    [onChange, setMenuAnchorEl],
  )

  const onMenuClose = React.useCallback(() => setMenuAnchorEl(null), [setMenuAnchorEl])

  return (
    <>
      <Button onClick={onButtonClick}>Promote to bucket</Button>

      <SuccessorsSelect
        anchorEl={menuAnchorEl}
        bucket={bucket}
        open={!!menuAnchorEl}
        onChange={onMenuClick}
        onClose={onMenuClose}
      />
    </>
  )
}
