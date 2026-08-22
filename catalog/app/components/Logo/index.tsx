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

// 'mark' = the compact legacy square (default; fits square/tight slots).
// 'wordmark' = the full quilt.bio horizontal lockup for wide slots (the rail
// header, sign-in), where the brand should read as a name, not a dot.
// 'icon' = the full-color quilt.bio "Q" logomark, a centered square that reads
// on its own in an icon-width slot.
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
    // The wordmark is drawn as a background image, so the box has no intrinsic
    // width to shrink-wrap. Callers pass width="100%", which resolves to `auto`
    // -- i.e. 0 -- whenever the parent is itself shrink-to-fit (a bare <a> in a
    // row flex container, as in BareHeader). Hold the box open at the lockup's
    // own aspect ratio (quilt-wordmark.png is 1440x301, ~4.79:1) so the mark is
    // visible regardless of how the parent sizes itself.
    ...(variant === 'wordmark' ? { minWidth: `calc(${height} * 4.79)` } : null),
    // The wordmark is a wide lockup: fit it by height, let width flex, and keep
    // it left-aligned and vertically centered. The icon is a square logomark:
    // contain and center it. 'mark' keeps its original sizing (HACK below).
    backgroundSize:
      variant === 'wordmark'
        ? `auto ${height}`
        : variant === 'icon'
          ? `${height} ${height}`
          : // HACK: hardcoded increased height, because there is the tall "l" in logo
            height === width
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
  | { _tag: 'pending' }
  | { _tag: 'error'; error: unknown; src: string }

function CustomLogo({
  className,
  src,
  height,
  width,
  variant,
}: LogoProps & { src: string }) {
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

  const classes = useStyles({ height, width, variant })
  switch (parsedSrc._tag) {
    case 'ok':
      return <img src={parsedSrc.src} className={cx(classes.custom, className)} />
    case 'pending':
      return <QuiltLogo className={className} height={height} width={width} />
    case 'error':
      // A broken custom logo falls back to the built-in one for the SAME slot, so
      // the variant has to travel: a wide rail slot that fell back to the compact
      // mark would silently change the brand lockup on an error path.
      return (
        <QuiltLogo
          className={className}
          height={height}
          width={width}
          variant={variant}
        />
      )
    default:
      assertNever(parsedSrc)
  }
}

export default function Logo({ src, ...rest }: LogoProps) {
  return src ? <CustomLogo src={src} {...rest} /> : <QuiltLogo {...rest} />
}
