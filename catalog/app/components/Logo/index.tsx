import cx from 'classnames'
import * as React from 'react'
import * as Sentry from '@sentry/react'
import * as M from '@material-ui/core'

import * as AWS from 'utils/AWS'
import assertNever from 'utils/assertNever'
import * as s3paths from 'utils/s3paths'

import quilt from './quilt.png'

interface LogoProps {
  className?: string
  src?: string
  height: string
  width: string
}

const useStyles = M.makeStyles(() => ({
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

type ParsedSrc =
  | { _tag: 'ok'; src: string }
  | { _tag: 'pending' }
  | { _tag: 'error'; error: unknown; src: string }

function CustomLogo({ className, src, height, width }: LogoProps & { src: string }) {
  const sign = AWS.Signer.useS3Signer()
  const [parsedSrc, setParsedSrc] = React.useState<ParsedSrc>({ _tag: 'pending' })
  React.useEffect(() => {
    let mounted = true
    const set = (v: ParsedSrc) => mounted && setParsedSrc(v)
    if (!s3paths.isS3Url(src)) {
      set({ _tag: 'ok', src })
    } else {
      try {
        const parsed = s3paths.parseS3Url(src)
        if (!parsed.key) {
          set({ _tag: 'error', error: new Error('S3 URL has no key'), src })
        } else {
          // sign is async in v3 (presigner)
          Promise.resolve(sign(parsed))
            .then((signed) => set({ _tag: 'ok', src: signed }))
            .catch((error) => set({ _tag: 'error', error, src }))
        }
      } catch (error) {
        set({ _tag: 'error', error, src })
      }
    }
    return () => {
      mounted = false
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
    case 'pending':
      return <QuiltLogo className={className} height={height} width={width} />
    case 'error':
      return <QuiltLogo className={className} height={height} width={width} />
    default:
      assertNever(parsedSrc)
  }
}

export default function Logo({ src, ...rest }: LogoProps) {
  return src ? <CustomLogo src={src} {...rest} /> : <QuiltLogo {...rest} />
}
