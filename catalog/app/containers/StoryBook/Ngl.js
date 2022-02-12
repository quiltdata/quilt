import * as NGL from 'ngl'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as AWS from 'utils/AWS'
import * as s3paths from 'utils/s3paths'

const useStyles = M.makeStyles((t) => ({
  root: {
    borderBottom: `1px solid ${t.palette.divider}`,
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: t.spacing(2),
    paddingBottom: t.spacing(2),
  },
  ngl: {
    width: t.spacing(60),
    height: t.spacing(50),
  },
  thumb: {
    width: t.spacing(30),
    height: t.spacing(20),
  },
}))

function fetchFile(s3, handle) {
  return s3
    .getObject({
      Bucket: handle.bucket,
      Key: handle.key,
    })
    .promise()
}

async function renderNgl(s3, url, wrapperEl) {
  const handle = s3paths.parseS3Url(url)
  const r = await fetchFile(s3, handle)

  const stage = new NGL.Stage(wrapperEl)

  const resizeObserver = new window.ResizeObserver(() => stage.handleResize())
  resizeObserver.observe(wrapperEl)

  await stage.loadFile(new Blob(r.Body), {
    ext: 'pdb',
  })
  return stage
}

async function renderThumb(stage, wrapperEl) {
  const imageBlob = await stage.makeImage()
  const imageEl = new Image()
  const ctx = wrapperEl.getContext('2d')
  imageEl.onload = () => ctx.drawImage(imageEl, 0, 0)
  imageEl.src = window.URL.createObjectURL(imageBlob)
  return stage
}

export default ({ url }) => {
  const s3 = AWS.S3.use()
  const classes = useStyles()

  const viewport = React.useRef()
  const img = React.useRef()

  React.useEffect(() => {
    renderNgl(s3, url, viewport.current).then((stage) => renderThumb(stage, img.current))
    return () => {
      // TODO: stage.dispose()
    }
  }, [img, viewport, s3, url])
  return (
    <div className={classes.root}>
      <div ref={viewport} className={classes.ngl} />
      <br />
      <canvas ref={img} className={classes.thumb} />
    </div>
  )
}
