import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as AWS from 'utils/AWS'
import * as s3paths from 'utils/s3paths'

import quilt from './quilt.png'

interface LogoProps {
  className?: string
  src?: string
  height: string
  width: string
}

const useStyles = M.makeStyles(({}) => ({
  custom: ({ height }: { height: string }) => ({
    height,
  }),
  quilt: ({ height, width }: { height: string; width: string }) => ({
    height,
    width,
    // HACK: hardcoded increased height, because there is the tall "l" in logo
    backgroundSize:
      height === width ? `auto ${Number.parseInt(height) + 2}px` : `auto ${height}`,
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
  const sign = AWS.Signer.useS3Signer()
  const parsedSrc = React.useMemo(() => {
    if (!src || !s3paths.isS3Url(src)) return src
    return sign(s3paths.parseS3Url(src))
  }, [sign, src])
  const classes = useStyles({ height, width })
  return <img src={parsedSrc} className={cx(classes.custom, className)} />
}

export default function Logo({ src, ...rest }: LogoProps) {
  return src ? <CustomLogo src={src} {...rest} /> : <QuiltLogo {...rest} />
}
