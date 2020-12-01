import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import * as AWS from 'utils/AWS'
import { useData } from 'utils/Data'

import * as requests from './requests'

function MenuPlaceholder() {
  const t = M.useTheme()

  return (
    <M.Box minWidth={t.spacing(22)}>
      <M.MenuItem disabled>
        <Lab.Skeleton height={t.spacing(6)} width="100%" />
      </M.MenuItem>
      <M.MenuItem disabled>
        <Lab.Skeleton height={t.spacing(6)} width="100%" />
      </M.MenuItem>
      <M.MenuItem disabled>
        <Lab.Skeleton height={t.spacing(6)} width="100%" />
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

function SuccessorsSelect({ anchorEl, bucket, open, onChange, onClose }) {
  const s3 = AWS.S3.use()
  const data = useData(requests.workflowsList, { s3, bucket })

  // FIXME: add documentation link
  return (
    <M.Menu anchorEl={anchorEl} onClose={onClose} open={open}>
      {data.case({
        Ok: ({ successors }) => (
          <div>
            {successors.length ? (
              successors.map((successor) => (
                <MenuItem key={successor.slug} item={successor} onClick={onChange} />
              ))
            ) : (
              <M.Box px={2} py={1}>
                <M.Typography>
                  Bucket&apos;s successors are not configured.
                  {/* <br /> */}
                  {/* Please, refer to a documentation. */}
                </M.Typography>
              </M.Box>
            )}
          </div>
        ),
        _: () => <MenuPlaceholder />,
        Err: (error) => (
          <M.Box px={2} py={1}>
            <Lab.Alert severity="error">{error.message}</Lab.Alert>
          </M.Box>
        ),
      })}
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
  const t = M.useTheme()
  const xs = M.useMediaQuery(t.breakpoints.down('xs'))

  const props = {
    'aria-haspopup': 'true',
    className: classes.root,
    onClick,
    size: 'small',
  }

  return xs ? (
    <M.IconButton edge="end" title={children} {...props}>
      <M.Icon>input</M.Icon>
    </M.IconButton>
  ) : (
    <M.Button startIcon={<M.Icon>arrow_right_alt</M.Icon>} variant="outlined" {...props}>
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
      <Button onClick={onButtonClick}>Push to bucket</Button>

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
