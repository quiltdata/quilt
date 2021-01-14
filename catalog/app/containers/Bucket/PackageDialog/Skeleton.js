import * as React from 'react'
import * as M from '@material-ui/core'

import Skeleton from 'components/Skeleton'

export function FilesInputSkeleton({ animate, className }) {
  return (
    <M.Box className={className}>
      <Skeleton {...{ height: 24, width: 64, animate }} />
      <Skeleton {...{ height: 140, mt: 2, animate }} />
    </M.Box>
  )
}

export function MetaInputSkeleton({ animate, className }) {
  return (
    <M.Box className={className}>
      <M.Box display="flex" mb={2}>
        <Skeleton {...{ height: 24, width: 64, animate }} />
        <M.Box flexGrow={1} />
        <Skeleton {...{ height: 24, width: 64, animate }} />
      </M.Box>
      <M.Box display="flex">
        <Skeleton {...{ height: 32, width: 200, animate }} />
        <Skeleton {...{ height: 32, ml: 0.5, flexGrow: 1, animate }} />
      </M.Box>
      <M.Box display="flex" mt={0.5}>
        <Skeleton {...{ height: 32, width: 200, animate }} />
        <Skeleton {...{ height: 32, ml: 0.5, flexGrow: 1, animate }} />
      </M.Box>
    </M.Box>
  )
}

const useFormSkeletonStyles = M.makeStyles((t) => ({
  files: {
    marginTop: t.spacing(3),
  },
  meta: {
    marginTop: t.spacing(3),
  },
}))

export function FormSkeleton({ animate }) {
  const classes = useFormSkeletonStyles()

  return (
    <>
      <Skeleton {...{ height: 48, mt: 2, animate }} />
      <Skeleton {...{ height: 48, mt: 3, animate }} />

      <FilesInputSkeleton className={classes.files} animate />

      <MetaInputSkeleton className={classes.meta} animate />

      <Skeleton {...{ height: 80, mt: 3, mb: 3, animate }} />
    </>
  )
}
