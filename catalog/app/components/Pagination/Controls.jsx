import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(0.5),
  },
}))

// direction: left | right
function Chevron({ direction, ...rest }) {
  const classes = useStyles()
  return (
    <M.IconButton className={classes.root} {...rest}>
      <M.Icon>{`chevron_${direction}`}</M.Icon>
    </M.IconButton>
  )
}

export default function Controls({ page, pages, nextPage, prevPage }) {
  return pages <= 1 ? null : (
    <M.Box display="flex" alignItems="center">
      <Chevron direction="left" onClick={prevPage} disabled={page <= 1} />
      <Chevron direction="right" onClick={nextPage} disabled={page >= pages} />
      <M.Box ml={1.5}>
        {page} of {pages}
      </M.Box>
    </M.Box>
  )
}
