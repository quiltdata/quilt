import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import FileTree from 'components/FileManager/FileTree'
import { L } from 'components/Form/Package/types'
// import { readableBytes } from 'utils/string'

import type { BucketListingResult } from '../requests'

import * as State from './State'
// import { TAB_BOOKMARKS, TAB_S3, Tab } from './State/Files'

// const useTabsStyles = M.makeStyles((t) => ({
//   tabs: {
//     marginLeft: 'auto',
//     minHeight: t.spacing(3),
//   },
//   tab: {
//     fontWeight: 'normal',
//     fontSize: '12px',
//     minWidth: t.spacing(15),
//     minHeight: t.spacing(3),
//   },
// }))
//
// interface TabsProps {
//   className: string
//   value: Tab
//   onChange: (v: Tab) => void
// }
//
// function Tabs({ className, value, onChange }: TabsProps) {
//   const classes = useTabsStyles()
//   const handleChange = React.useCallback((event, v: Tab) => onChange(v), [onChange])
//   return (
//     <M.Tabs className={cx(classes.tabs, className)} onChange={handleChange} value={value}>
//       <M.Tab className={classes.tab} label="S3 Bucket" value={TAB_S3} />
//       <M.Tab className={classes.tab} label="Bookmarks" value={TAB_BOOKMARKS} />
//     </M.Tabs>
//   )
// }

const useFilterStyles = M.makeStyles(() => ({
  root: {},
}))

interface FilterProps {
  className: string
  value: string
  onChange: (v: string) => void
}

function Filter({ className, value, onChange }: FilterProps) {
  const classes = useFilterStyles()
  const handleChange = React.useCallback(
    (event) => onChange(event.target.value),
    [onChange],
  )
  return (
    <M.TextField
      className={cx(classes.root, className)}
      onChange={handleChange}
      size="small"
      value={value}
      label="Filter by prefix"
      variant="outlined"
    />
  )
}

function Listing({ r }: { r: BucketListingResult }) {
  const entries = React.useMemo(
    () => [
      ...r.dirs.map((name) => ({
        id: name,
        name,
      })),
      ...r.files.map((file) => ({
        id: file.key,
        modifiedDate: file.modified,
        name: file.key,
        size: file.size,
      })),
    ],
    [r.dirs, r.files],
  )
  return <FileTree entries={entries} draggable />
}

const useStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
  },
  filter: {
    marginBottom: t.spacing(1),
  },
  header: {
    ...t.typography.subtitle1,
    marginBottom: t.spacing(2),
    display: 'flex',
  },
  // tabs: {
  //   marginLeft: 'auto',
  // },
  content: {
    flexGrow: 1,
  },
}))

interface RemoteFilesProps {
  className: string
}

export default function RemoteFiles({ className }: RemoteFilesProps) {
  const classes = useStyles()
  const { files } = State.use()
  if (files.state === L) return null
  return (
    <div className={cx(classes.root, className)}>
      <div className={classes.header}>
        S3 sources
        {/*
        <Tabs
          className={classes.tabs}
          value={files.state.tab}
          onChange={files.actions.onTab}
        />
        */}
      </div>
      <Filter
        value={files.state.filter.value}
        onChange={files.actions.filter.onChange}
        className={classes.filter}
      />
      <div className={classes.content}>
        {files.state.remote.case({
          Ok: (r: BucketListingResult) => <Listing r={r} />,
          _: () => <M.CircularProgress />,
        })}
      </div>
    </div>
  )
}
