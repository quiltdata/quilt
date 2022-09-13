import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import fancyBg from './fancy-bg.png'

const useStyles = M.makeStyles({
  fancy: {
    background: `center / cover url(${fancyBg})`,
  },
  light: {
    background: 'linear-gradient(to right, #30266e, #1b194f)',
  },
  container: {
    position: 'relative',
    zIndex: 1,
  },
})

interface SectionProps {
  bg?: 'fancy' | 'light'
  children: M.ContainerProps['children']
}

export default function Section({ bg, children }: SectionProps) {
  const classes = useStyles()
  return (
    <div className={cx(bg && classes[bg])}>
      <M.Container className={classes.container} maxWidth="lg">
        {children}
      </M.Container>
    </div>
  )
}
