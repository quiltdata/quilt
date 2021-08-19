import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles({
  root: {
    display: 'inline-block',
    paddingTop: (props: { drop?: number | string }) => props.drop || 0,
  },
})

interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  drop?: number | string
  className?: string
}

export default function Spinner({ className, drop, ...props }: SpinnerProps) {
  const classes = useStyles({ drop })
  return (
    <div className={cx(className, classes.root)} {...props}>
      <i className="fa fa-cog fa-fw fa-spin" />
    </div>
  )
}
