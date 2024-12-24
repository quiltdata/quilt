import * as React from 'react'
import * as M from '@material-ui/core'

import Skeleton from 'components/Skeleton'

import * as Layout from './Layout'

interface AnimateProp {
  animate?: boolean
}

interface ClassNameProp {
  className?: string
}

export function TextFieldSkeleton({ animate }: AnimateProp) {
  return <Skeleton {...{ height: 54, mt: 2, mb: 1, animate }} />
}

export function FilesInputSkeleton({ animate, className }: AnimateProp & ClassNameProp) {
  return (
    <div className={className}>
      <Skeleton {...{ height: 24, width: 64, animate }} />
      <Skeleton {...{ height: 336, mt: 2, animate }} />
    </div>
  )
}

export const MetaInputSkeleton = React.forwardRef(function MetaInputSkeleton(
  { animate, className }: AnimateProp & ClassNameProp,
  ref: React.Ref<HTMLDivElement>,
) {
  return (
    <div className={className}>
      <M.Box display="flex" mb={2}>
        <Skeleton {...{ height: 24, width: 64, animate }} />
        <M.Box flexGrow={1} />
        <Skeleton {...{ height: 24, width: 64, animate }} />
      </M.Box>
      <div ref={ref}>
        <M.Box display="flex">
          <Skeleton {...{ height: 32, width: 200, animate }} />
          <Skeleton {...{ height: 32, ml: 0.5, flexGrow: 1, animate }} />
        </M.Box>
        <M.Box display="flex" mt={0.5}>
          <Skeleton {...{ height: 32, width: 200, animate }} />
          <Skeleton {...{ height: 32, ml: 0.5, flexGrow: 1, animate }} />
        </M.Box>
      </div>
    </div>
  )
})

export function WorkflowsInputSkeleton({ animate }: AnimateProp) {
  return <Skeleton {...{ height: 80, mt: 3, mb: 3, animate }} />
}

const useFormSkeletonStyles = M.makeStyles((t) => ({
  files: {
    marginTop: t.spacing(2),
  },
  meta: {
    marginTop: t.spacing(3),
  },
}))

export function FormSkeleton({ animate }: AnimateProp) {
  const classes = useFormSkeletonStyles()

  return (
    <Layout.Container>
      <Layout.LeftColumn>
        <TextFieldSkeleton animate={animate} />
        <TextFieldSkeleton animate={animate} />

        <MetaInputSkeleton className={classes.meta} animate={animate} />

        <WorkflowsInputSkeleton animate={animate} />
      </Layout.LeftColumn>

      <Layout.RightColumn>
        <FilesInputSkeleton className={classes.files} animate={animate} />
      </Layout.RightColumn>
    </Layout.Container>
  )
}
