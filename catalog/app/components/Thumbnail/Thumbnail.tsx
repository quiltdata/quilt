import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import Skeleton from 'components/Skeleton'
import cfg from 'constants/config'
import * as AWS from 'utils/AWS'
import { useBucketExistence } from 'utils/BucketCache'
import AsyncResult from 'utils/AsyncResult'
import type { S3ObjectLocation } from 'model/S3'
import { mkSearch } from 'utils/NamedRoutes'
import { HTTPError } from 'utils/APIConnector'
import pipeThru from 'utils/pipeThru'
import usePrevious from 'utils/usePrevious'

import checkboard from './checkboard.svg'
import glacier from './glacier.svg'

export const SUPPORTED_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.bmp',
  '.tiff',
  '.tif',
  '.czi',
]

type Size = 'sm' | 'lg'

const SIZES: Record<Size, { w: number; h: number }> = {
  sm: { w: 256, h: 256 },
  lg: { w: 1024, h: 768 },
}

const sizeStr = (s: Size) => `w${SIZES[s].w}h${SIZES[s].h}`

const loadImg = async (src: string) => {
  const r = await fetch(src)
  if (r.status === 200) return r.blob()
  const text = await r.text()
  const e = new HTTPError(r, text)
  throw e
}

const useSkeletonStyles = M.makeStyles((t) => ({
  container: {
    paddingBottom: '70%',
    position: 'relative',
  },
  inner: {
    alignItems: 'center',
    bottom: 0,
    display: 'flex',
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  iconGlacier: {
    maxHeight: '50%',
    maxWidth: '50%',
    opacity: 0.1,
  },
  iconError: {
    color: t.palette.text.primary,
    fontSize: 80,
    opacity: 0.1,
  },
}))

interface ThumbnailSkeletonProps extends M.BoxProps {
  icon?: 'glacier' | 'error'
  className?: string
  animate?: boolean
}

export function ThumbnailSkeleton({
  icon,
  className,
  animate,
  ...props
}: ThumbnailSkeletonProps) {
  const classes = useSkeletonStyles()
  return (
    <Skeleton
      borderRadius="borderRadius"
      className={cx(className, classes.container)}
      animate={animate != null ? animate : !icon}
      {...props}
    >
      {icon === 'glacier' && (
        <div className={classes.inner}>
          <img alt="" src={glacier} className={classes.iconGlacier} />
        </div>
      )}
      {icon === 'error' && (
        <div className={classes.inner}>
          <M.Icon className={classes.iconError}>error_outline</M.Icon>
        </div>
      )}
    </Skeleton>
  )
}

const useStyles = M.makeStyles({
  root: {
    background: `0 0 url("${checkboard}") repeat`,
  },
})

interface ThumbnailInnerProps extends M.BoxProps {
  handle: S3ObjectLocation
  size?: Size
  alt?: string
  className?: string
  title?: string
}

function ThumbnailInner({
  handle,
  size = 'sm',
  alt = '',
  className,
  ...props
}: ThumbnailInnerProps) {
  const sign = AWS.Signer.useS3Signer()

  const classes = useStyles()

  const [state, setState] = React.useState(AsyncResult.Init())

  usePrevious(handle, (prev) => {
    if (R.equals(handle, prev)) return
    const url = sign(handle)
    const src = `${cfg.apiGatewayEndpoint}/thumbnail${mkSearch({
      url,
      size: sizeStr(size),
    })}`
    setState(AsyncResult.Pending())
    loadImg(src)
      .then((blob) => {
        const objUrl = window.URL.createObjectURL(blob)
        setState(AsyncResult.Ok(objUrl))
      })
      .catch((e) => {
        setState(AsyncResult.Err(e))
      })
  })

  // revoke object url when it changes or component unmounts
  const cleanupUrl = pipeThru(state)(AsyncResult.case({ Ok: R.identity, _: () => null }))
  React.useEffect(
    () => () => {
      if (cleanupUrl) window.URL.revokeObjectURL(cleanupUrl)
    },
    [cleanupUrl],
  )

  return pipeThru(state)(
    AsyncResult.case({
      _: () => <ThumbnailSkeleton {...props} />,
      Ok: (src: string) => (
        <M.Box
          className={cx(classes.root, className)}
          component="img"
          {...({ src, alt } as any)}
          {...props}
        />
      ),
      Err: (e: unknown) => {
        let title = 'Error loading image'
        let icon: 'glacier' | 'error' = 'error'
        if (e instanceof HTTPError) {
          if (
            e.json &&
            e.json.error === 'Forbidden' &&
            e.json.text &&
            e.json.text.match(/InvalidObjectState/)
          ) {
            title = 'Object archived'
            icon = 'glacier'
          } else if (e.message) {
            title = e.message
          }
        }
        return (
          <ThumbnailSkeleton
            icon={icon}
            {...props}
            title={props.title ? `${props.title}: ${title}` : title}
          />
        )
      },
    }),
  )
}

interface ThumbnailProps extends M.BoxProps {
  handle: S3ObjectLocation
  size?: Size
  alt?: string
  className?: string
  title?: string
}

// Ensure the file bucket's region is cached for correct presigned URLs.
// For same-bucket files this is instant (already cached by BucketLayout).
export default function Thumbnail({ handle, ...props }: ThumbnailProps) {
  // Be not afraid: both useBucketExistence and .case() are memoized (see Data.js).
  return useBucketExistence(handle.bucket).case({
    Ok: () => <ThumbnailInner handle={handle} {...props} />,
    Err: () => <ThumbnailSkeleton icon="error" {...props} />,
    _: () => <ThumbnailSkeleton {...props} />,
  })
}
