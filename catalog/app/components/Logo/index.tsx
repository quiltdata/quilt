import cx from 'classnames'
import * as React from 'react'

import * as M from '@material-ui/core'

import quilt from './quilt.png'

interface LogoProps {
  className?: string
  src?: string
  height: string
  width: string
}

const useStyles = M.makeStyles(({}) => ({
  custom: ({ src, height, width }: { src?: string; height: string; width: string }) => ({
    height,
    width,
    backgroundSize: 'contain',
    backgroundImage: `url(${src})`,
    backgroundPosition: '50% 50%',
    backgroundRepeat: 'no-repeat',
  }),
  quilt: ({ height, width }: { height: string; width: string }) => ({
    height,
    width,
    backgroundSize: `auto ${height}`,
    backgroundImage: `url(${quilt})`,
    backgroundPosition: '0 100%',
    backgroundRepeat: 'no-repeat',
  }),
}))

function QuiltLogo({ className, height, width }: LogoProps) {
  const classes = useStyles({ height, width })
  return <div className={cx(classes.quilt, className)} />
}

function CustomLogo({ className, src, height, width }: LogoProps) {
  const classes = useStyles({ height, src, width })
  return <div className={cx(classes.custom, className)} />
}

export default function Logo({ src, ...rest }: LogoProps) {
  return src ? <CustomLogo src={src} {...rest} /> : <QuiltLogo {...rest} />
}
