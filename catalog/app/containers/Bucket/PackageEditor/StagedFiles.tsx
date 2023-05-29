import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import { Status, LocalEntry } from 'components/FileManager/FileRow'
import FileTree from 'components/FileManager/FileTree'
import { L } from 'components/Form/Package/types'

import * as State from './State'

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
  const { files } = State.use()
  const entries: LocalEntry[] = React.useMemo(() => {
    if (files.state === L) return []
    return Object.entries(files.state.value).map(([name, entry]) => ({
      id: entry.physicalKey,
      name: name,
      size: entry.size,
      status: Status.Unchanged,
    }))
  }, [files.state])
  if (files.state === L) return null
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
      <div className={classes.dropzone} {...files.state.dropzone.root}>
        <input {...files.state.dropzone.input} />
        Drop files or click to browse
        {entries.length && <FileTree entries={entries} />}
      </div>
    </div>
  )
}
