import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

const useLoadNextPageStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(1, 0),
    display: 'flex',
    justifyContent: 'flex-end',
  },
  button: {
    background: t.palette.background.paper,
  },
}))

interface LoadNextPageProps {
  className: string
  loading?: boolean
  onClick?: () => void
}

export default function LoadNextPage({
  className,
  loading = false,
  onClick,
}: LoadNextPageProps) {
  const classes = useLoadNextPageStyles()
  return (
    <div className={cx(classes.root, className)}>
      <M.Button
        endIcon={
          loading ? <M.CircularProgress size={16} /> : <M.Icon>expand_more</M.Icon>
        }
        onClick={onClick}
        variant="outlined"
        disabled={loading}
        className={classes.button}
      >
        Load more
      </M.Button>
    </div>
  )
}
