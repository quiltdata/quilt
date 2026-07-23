import cx from 'classnames'
import * as React from 'react'
import * as Sentry from '@sentry/react'
import * as M from '@material-ui/core'

import * as AWS from 'utils/AWS'
import assertNever from 'utils/assertNever'
import * as s3paths from 'utils/s3paths'

import quilt from './quilt.png'
import quiltIcon from './quilt-icon.png'
import quiltWordmark from './quilt-wordmark.png'

// 'mark' = the compact coral-dot square (default; fits square/tight slots).
// 'wordmark' = the full quilt.bio horizontal lockup for wide slots (e.g. the
// NavBar header + sign-in), where the brand should read as a name, not a dot.
// 'icon' = the full-color quilt.bio "Q" logomark, a centered square that reads
// on its own — used where the rail collapses to icons only.
type LogoVariant = 'mark' | 'wordmark' | 'icon'

interface LogoProps {
  className?: string
  src?: string
  height: string
  width: string
  variant?: LogoVariant
}

const useStyles = M.makeStyles(() => ({
  custom: ({ height }: { height: string }) => ({
    height,
  }),
  quilt: ({
    height,
    width,
    variant,
  }: {
    height: string
    width: string
    variant?: LogoVariant
  }) => ({
    height,
    width,
    // The wordmark is a wide lockup: fit it by height and let width flex, left-
    // aligned. The icon is a square logomark: contain it and center it in the
    // slot. The mark keeps its original sizing (HACK: +2px for the tall "l").
    backgroundSize:
      variant === 'wordmark'
        ? `auto ${height}`
        : variant === 'icon'
          ? `${height} ${height}`
          : height === width
            ? `auto ${Number.parseInt(height) + 2}px`
            : `auto ${height}`,
    backgroundImage: `url(${
      variant === 'wordmark' ? quiltWordmark : variant === 'icon' ? quiltIcon : quilt
    })`,
    backgroundPosition:
      variant === 'wordmark' ? '0 50%' : variant === 'icon' ? '50% 50%' : '0 100%',
    backgroundRepeat: 'no-repeat',
  }),
}))

function QuiltLogo({ className, height, width, variant = 'mark' }: LogoProps) {
  const classes = useStyles({ height, width, variant })
  return <div className={cx(classes.quilt, className)} />
}

type ParsedSrc =
  | { _tag: 'ok'; src: string }
  | { _tag: 'error'; error: unknown; src: string }

function CustomLogo({ className, src, height, width }: LogoProps & { src: string }) {
  const sign = AWS.Signer.useS3Signer()
  const parsedSrc = React.useMemo<ParsedSrc>(() => {
    if (!s3paths.isS3Url(src)) return { _tag: 'ok', src }
    try {
      const parsed = s3paths.parseS3Url(src)
      if (!parsed.key) {
        return { _tag: 'error', error: new Error('S3 URL has no key'), src }
      }
      return { _tag: 'ok', src: sign(parsed) }
    } catch (error) {
      return { _tag: 'error', error, src }
    }
  }, [sign, src])

  React.useEffect(() => {
    if (parsedSrc._tag === 'error') {
      Sentry.captureException(parsedSrc.error, { extra: { src: parsedSrc.src } })
    }
  }, [parsedSrc])

  const classes = useStyles({ height, width })
  switch (parsedSrc._tag) {
    case 'ok':
      return <img src={parsedSrc.src} className={cx(classes.custom, className)} />
    case 'error':
      return <QuiltLogo className={className} height={height} width={width} />
    default:
      assertNever(parsedSrc)
  }
}

export default function Logo({ src, ...rest }: LogoProps) {
  return src ? <CustomLogo src={src} {...rest} /> : <QuiltLogo {...rest} />
}
