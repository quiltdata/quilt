import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    ...t.typography.subtitle1,
    marginBottom: t.spacing(2),
    display: 'flex',
  },
  dropzone: {
    background: t.palette.action.selected,
    border: `1 px solid ${t.palette.action.disabled}`,
    borderRadius: t.shape.borderRadius,
    flexGrow: 1,
  },
  expand: {
    marginLeft: 'auto',
    opacity: 0.3,
    '&:hover': {
      opacity: 1,
    },
  },
}))

interface StagedFilesProps {
  className: string
  onExpand: () => void
  expanded: boolean
}

export default function StagedFiles({ className, expanded, onExpand }: StagedFilesProps) {
  const classes = useStyles()
  return (
    <div className={cx(classes.root, className)}>
      <div className={classes.header}>
        Package contents
        <M.Fade in={expanded}>
          <M.IconButton onClick={onExpand} className={classes.expand} size="small">
            <M.Icon fontSize="small">zoom_out_map</M.Icon>
          </M.IconButton>
        </M.Fade>
      </div>
      <div className={classes.dropzone}>Drop files or click to browse</div>
    </div>
  )
}
