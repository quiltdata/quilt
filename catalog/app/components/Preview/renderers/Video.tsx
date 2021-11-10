import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles({
  root: {
    display: 'block',
    height: '240px',
    margin: 'auto',
    maxWidth: '100%',
  },
})

interface VideoProps extends React.HTMLAttributes<HTMLVideoElement> {
  className?: string
  src: string
}

function Video({ src, className, ...props }: VideoProps) {
  const classes = useStyles()
  return (
    <video controls muted src={src} className={cx(className, classes.root)} {...props} />
  )
}

export default (img: VideoProps, props: VideoProps) => <Video {...img} {...props} />
