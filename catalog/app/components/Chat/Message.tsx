import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'

import Markdown from 'components/Markdown'
import Skel from 'components/Skeleton'

const useSkeletonStyles = M.makeStyles((t) => ({
  text: {
    height: t.spacing(2),
    '& + &': {
      marginTop: t.spacing(1),
    },
  },
}))

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  const classes = useSkeletonStyles()
  return (
    <div className={className}>
      <Skel className={classes.text} width="30%" />
      <Skel className={classes.text} width="90%" />
      <Skel className={classes.text} width="70%" />
      <Skel className={classes.text} width="50%" />
    </div>
  )
}

interface AssistantProps {
  className?: string
  content: string
}

export function Assistant({ className, content }: AssistantProps) {
  return (
    <div className={className}>
      <Markdown data={content} />
    </div>
  )
}

const useUserStyles = M.makeStyles((t) => ({
  root: {
    borderRadius: t.shape.borderRadius,
    background: t.palette.primary.main,
  },
  inner: {
    padding: t.spacing(2),
    background: fade(t.palette.background.paper, 0.9),
  },
}))

interface UserProps {
  className?: string
  content: string
}

export function User({ className, content }: UserProps) {
  const classes = useUserStyles()

  return (
    <div className={cx(classes.root, className)}>
      <div className={classes.inner}>
        <Markdown data={content} />
      </div>
    </div>
  )
}
