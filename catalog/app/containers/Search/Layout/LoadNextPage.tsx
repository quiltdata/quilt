import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

const WE_DONT_KNOW_IF_NEXT_PAGE_AVAILABLE =
  'Due to secure search restrictions, some results may be filtered out. More results might exist.'

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
  determinate: boolean
  loading?: boolean
  onClick?: () => void
}

export default function LoadNextPage({
  className,
  determinate,
  loading = false,
  onClick,
}: LoadNextPageProps) {
  const classes = useLoadNextPageStyles()
  const title = determinate ? '' : WE_DONT_KNOW_IF_NEXT_PAGE_AVAILABLE
  return (
    <div className={cx(classes.root, className)}>
      <M.Tooltip title={title}>
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
      </M.Tooltip>
    </div>
  )
}
