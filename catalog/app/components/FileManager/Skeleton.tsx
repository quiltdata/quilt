import * as React from 'react'
import * as M from '@material-ui/core'

import Skeleton from 'components/Skeleton'

import { HEIGHT } from './FileRow'

const useFileRowSkeletonStyles = M.makeStyles<$TSFixMe, { odd: boolean }>((t) => ({
  root: {
    display: 'flex',
    height: `${HEIGHT}px`,
    padding: t.spacing(0.5, 0),
  },
  checkbox: {
    margin: t.spacing(0, 0.5),
    width: t.spacing(3),
  },
  name: {
    flexGrow: 1,
    margin: ({ odd }) => t.spacing(0.5, odd ? 9 : 12, 0.5, 0.5),
  },
  modifiedDate: {
    margin: ({ odd }) => t.spacing(0.5, odd ? 9.5 : 6.5, 0.5, 0.5),
    width: ({ odd }) => t.spacing(odd ? 11 : 14),
  },
  size: {
    margin: ({ odd }) => t.spacing(0.5, odd ? 3.5 : 4.5, 0.5, 0.5),
    width: ({ odd }) => t.spacing(odd ? 9 : 8),
  },
}))

interface FileRowSkeletonProps {
  odd?: boolean
}

function FileRowSkeleton({ odd = false }: FileRowSkeletonProps) {
  const classes = useFileRowSkeletonStyles({ odd })
  return (
    <div className={classes.root}>
      <Skeleton className={classes.checkbox} animate />
      <Skeleton className={classes.name} animate />
      <Skeleton className={classes.modifiedDate} animate />
      <Skeleton className={classes.size} animate />
    </div>
  )
}

interface FilesTreeSkeletonProps {
  className?: string
}

export default function FilesTreeSkeleton({ className }: FilesTreeSkeletonProps) {
  return (
    <div className={className}>
      <FileRowSkeleton odd />
      <FileRowSkeleton />
      <FileRowSkeleton odd />
      <FileRowSkeleton />
      <FileRowSkeleton odd />
    </div>
  )
}
