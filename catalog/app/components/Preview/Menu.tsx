import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as AWS from 'utils/AWS'
import * as LogicalKeyResolver from 'utils/LogicalKeyResolver'

const useStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    display: 'flex',
    height: t.spacing(4),
    justifyContent: 'center',
    width: t.spacing(3),
  },
}))

interface MenuProps {
  className?: string
  handle: LogicalKeyResolver.S3SummarizeHandle
}

export default function Menu({ className, handle }: MenuProps) {
  const classes = useStyles()
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null)
  const downloadUrl = AWS.Signer.useDownloadUrl(handle)
  const handleClose = React.useCallback(() => setAnchorEl(null), [])
  const handleOpen = React.useCallback((e) => setAnchorEl(e.currentTarget), [])
  return (
    <div className={cx(classes.root, className)}>
      <M.IconButton onClick={handleOpen}>
        <M.Icon>more_vert</M.Icon>
      </M.IconButton>
      <M.Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleClose}>
        <M.MenuItem button component="a" href={downloadUrl} onClick={handleClose}>
          <M.ListItemIcon>
            <M.Icon>arrow_downward</M.Icon>
          </M.ListItemIcon>
          <M.ListItemText>Download</M.ListItemText>
        </M.MenuItem>
      </M.Menu>
    </div>
  )
}
