import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  dot: {
    background: M.colors.blueGrey[500],
    border: 'none',
    borderRadius: '50%',
    cursor: 'pointer',
    height: 12,
    outline: 'none',
    padding: 0,
    position: 'relative',
    width: 12,
    '&::before': {
      background: `linear-gradient(to top, #5c83ea, #6752e6)`,
      borderRadius: '50%',
      bottom: 0,
      boxShadow: [[0, 0, 16, 0, '#6072e9']],
      content: '""',
      left: 0,
      opacity: 0,
      position: 'absolute',
      right: 0,
      top: 0,
      transition: 'opacity 400ms',
    },
    '& + &': {
      marginLeft: t.spacing(2),
    },
  },
  current: {
    '&::before': {
      opacity: 1,
    },
  },
}))

export default function DotPagination({ total, current, onChange, ...props }) {
  const classes = useStyles()
  return (
    <M.Box display="flex" justifyContent="center" {...props}>
      {R.times(
        (i) => (
          <button
            type="button"
            // eslint-disable-next-line react/no-array-index-key
            key={i}
            onClick={() => onChange(i)}
            className={cx(classes.dot, current === i && classes.current)}
          />
        ),
        total,
      )}
    </M.Box>
  )
}
