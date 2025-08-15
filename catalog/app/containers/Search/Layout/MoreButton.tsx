import * as React from 'react'
import * as M from '@material-ui/core'

const useMoreButtonStyles = M.makeStyles({
  title: {
    paddingLeft: '3px',
  },
})

interface MoreButtonProps extends M.ButtonProps {
  reverse?: boolean
}

export default function MoreButton({ reverse, ...props }: MoreButtonProps) {
  const classes = useMoreButtonStyles()
  return (
    <M.Button
      startIcon={<M.Icon>{reverse ? 'expand_less' : 'expand_more'}</M.Icon>}
      size="small"
      {...props}
    >
      <span className={classes.title}>{reverse ? 'Less filters' : 'More filters'}</span>
    </M.Button>
  )
}
