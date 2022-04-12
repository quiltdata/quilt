import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import Skeleton from 'components/Skeleton'
import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import { useConfig } from 'utils/Config'
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
  '.czi',
]

const SIZES = {
  sm: { w: 256, h: 256 },
  lg: { w: 1024, h: 768 },
}

const sizeStr = (s) => `w${SIZES[s].w}h${SIZES[s].h}`

const loadImg = async (src) => {
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

export function ThumbnailSkeleton({
  icon, // glacier | error
  className,
  animate,
  ...props
}) {
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

export default function Thumbnail({
  handle,
  size = 'sm', // sm | lg
  alt = '',
  skeletonProps,
  className,
  ...props
}) {
  const api = useConfig().binaryApiGatewayEndpoint
  const sign = AWS.Signer.useS3Signer()

  const classes = useStyles()

  const [state, setState] = React.useState(AsyncResult.Init())

  usePrevious(handle, (prev) => {
    if (R.equals(handle, prev)) return
    const url = sign(handle)
    const src = `${api}/thumbnail${mkSearch({ url, size: sizeStr(size), output: 'raw' })}`
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
      _: () => <ThumbnailSkeleton {...skeletonProps} {...props} />,
      Ok: (src) => (
        <M.Box
          className={cx(classes.root, className)}
          component="img"
          src={src}
          alt={alt}
          {...props}
        />
      ),
      Err: (e) => {
        let title = 'Error loading image'
        let icon = 'error'
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
            {...skeletonProps}
            {...props}
            title={props.title ? `${props.title}: ${title}` : title}
          />
        )
      },
    }),
  )
}
