import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles({
  root: {},
})

interface GenbankProps {
  className?: string
  src: string
}

function Genbank({ className, src, ...props }: GenbankProps) {
  const classes = useStyles()
  return (
    <div className={cx(className, classes.root)}>
      <img src={`data:image/png;base64,${src}`} {...props} />
    </div>
  )
}

export default (data: GenbankProps, props: GenbankProps) => (
  <Genbank {...data} {...props} />
)
