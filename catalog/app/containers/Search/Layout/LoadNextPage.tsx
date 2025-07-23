import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

const WE_DONT_KNOW_IF_NEXT_PAGE_AVAILABLE =
  'Due to secure search, we must load and filter each result individually. More results might exist.'

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
  indeterminate: boolean
  loading?: boolean
  onClick?: () => void
}

export default function LoadNextPage({
  className,
  indeterminate,
  loading = false,
  onClick,
}: LoadNextPageProps) {
  const classes = useLoadNextPageStyles()
  return (
    <div className={cx(classes.root, className)}>
      <M.Tooltip title={!!indeterminate && WE_DONT_KNOW_IF_NEXT_PAGE_AVAILABLE}>
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
