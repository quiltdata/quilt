import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import LogosCarousel from 'website/pages/Landing/LogosCarousel'
import logos from 'website/pages/Landing/Logos/list'

const useStyles = M.makeStyles({
  root: {
    padding: '0 0 70px',
  },
})

interface PartnersProps {
  className?: string
}

export default function Partners({ className }: PartnersProps) {
  const classes = useStyles()
  return (
    <LogosCarousel
      className={cx(classes.root, className)}
      logos={logos}
      title="Life Sciences Organizations Run on Quilt"
    />
  )
}
