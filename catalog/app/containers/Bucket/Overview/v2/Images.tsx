import { basename } from 'path'

import * as React from 'react'
import * as M from '@material-ui/core'

import Thumbnail from 'components/Thumbnail'
import cfg from 'constants/config'
import type * as Model from 'model'
import * as APIConnector from 'utils/APIConnector'
import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import * as BucketPreferences from 'utils/BucketPreferences'
import { useData } from 'utils/Data'
import * as GQL from 'utils/GraphQL'

import * as requests from '../../requests'

import BUCKET_QUERY from '../gql/Bucket.generated'

const THUMB_SIZE = 96

const CAROUSEL_MIN_HEIGHT = 320
const CAROUSEL_MAX_HEIGHT = '70vh'

const useCarouselStyles = M.makeStyles((t) => ({
  paper: {
    backgroundColor: t.palette.common.black,
  },
  content: {
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'center',
    minHeight: CAROUSEL_MIN_HEIGHT,
    padding: t.spacing(2),
    position: 'relative',
  },
  stack: {
    display: 'flex',
    maxHeight: CAROUSEL_MAX_HEIGHT,
    maxWidth: '100%',
    position: 'relative',
  },
  previewImg: {
    bottom: 0,
    left: 0,
    maxHeight: CAROUSEL_MAX_HEIGHT,
    maxWidth: '100%',
    objectFit: 'contain',
    position: 'absolute',
    right: 0,
    top: 0,
  },
  thumbImg: {
    maxHeight: CAROUSEL_MAX_HEIGHT,
    maxWidth: '100%',
    objectFit: 'contain',
    position: 'relative',
  },
  nav: {
    color: t.palette.common.white,
  },
  navPrev: {
    left: t.spacing(1),
    position: 'absolute',
  },
  navNext: {
    position: 'absolute',
    right: t.spacing(1),
  },
  bar: {
    alignItems: 'center',
    color: t.palette.common.white,
    display: 'flex',
    justifyContent: 'space-between',
    padding: t.spacing(1, 2),
  },
}))

interface CarouselProps {
  images: Model.S3.S3ObjectLocation[]
  index: number
  onClose: () => void
  onChange: (index: number) => void
}

function Carousel({ images, index, onClose, onChange }: CarouselProps) {
  const classes = useCarouselStyles()
  const current = images[index]
  const prev = React.useCallback(
    () => onChange((index - 1 + images.length) % images.length),
    [index, images.length, onChange],
  )
  const next = React.useCallback(
    () => onChange((index + 1) % images.length),
    [index, images.length, onChange],
  )
  React.useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'ArrowRight') next()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [prev, next])
  const name = basename(current.key)
  return (
    <M.Dialog
      open
      maxWidth="lg"
      fullWidth
      onClose={onClose}
      classes={{ paper: classes.paper }}
    >
      <div className={classes.bar}>
        <M.Typography variant="body2" noWrap title={name}>
          {name} ({index + 1} of {images.length})
        </M.Typography>
        <M.IconButton
          className={classes.nav}
          size="small"
          onClick={onClose}
          aria-label="close"
        >
          <M.Icon>close</M.Icon>
        </M.IconButton>
      </div>
      <div className={classes.content}>
        {images.length > 1 && (
          <M.IconButton
            className={`${classes.nav} ${classes.navPrev}`}
            onClick={prev}
            aria-label="previous image"
          >
            <M.Icon>chevron_left</M.Icon>
          </M.IconButton>
        )}
        {/* A low-res `sm` render is layered underneath as an instant placeholder
            (it resolves quickly from the lambda's warm cache); the full `lg`
            render paints over it once its `<img>` resolves. */}
        <div className={classes.stack}>
          <Thumbnail
            key={`sm/${current.bucket}/${current.key}`}
            handle={current}
            size="sm"
            className={classes.previewImg}
            alt={name}
          />
          <Thumbnail
            key={`lg/${current.bucket}/${current.key}`}
            handle={current}
            size="lg"
            className={classes.thumbImg}
            alt={name}
            title={name}
          />
        </div>
        {images.length > 1 && (
          <M.IconButton
            className={`${classes.nav} ${classes.navNext}`}
            onClick={next}
            aria-label="next image"
          >
            <M.Icon>chevron_right</M.Icon>
          </M.IconButton>
        )}
      </div>
    </M.Dialog>
  )
}

const useStyles = M.makeStyles((t) => ({
  root: {
    marginTop: t.spacing(2),
    padding: t.spacing(2),
  },
  grid: {
    display: 'grid',
    gap: t.spacing(1),
    gridTemplateColumns: `repeat(auto-fill, ${THUMB_SIZE}px)`,
    marginTop: t.spacing(1),
  },
  thumb: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    height: THUMB_SIZE,
    overflow: 'hidden',
    padding: 0,
    width: THUMB_SIZE,
  },
  img: {
    height: '100%',
    objectFit: 'cover',
    width: '100%',
  },
}))

interface GalleryProps {
  images: Model.S3.S3ObjectLocation[]
}

function Gallery({ images }: GalleryProps) {
  const classes = useStyles()
  const [openIndex, setOpenIndex] = React.useState<number | null>(null)
  return (
    <M.Paper className={classes.root}>
      <M.Typography variant="subtitle1">Images</M.Typography>
      <div className={classes.grid}>
        {images.map((handle, i) => {
          const name = basename(handle.key)
          return (
            <button
              key={`${handle.bucket}/${handle.key}`}
              type="button"
              className={classes.thumb}
              onClick={() => setOpenIndex(i)}
              title={name}
            >
              <Thumbnail handle={handle} size="sm" className={classes.img} alt={name} />
            </button>
          )
        })}
      </div>
      {openIndex !== null && (
        <Carousel
          images={images}
          index={openIndex}
          onChange={setOpenIndex}
          onClose={() => setOpenIndex(null)}
        />
      )}
    </M.Paper>
  )
}

interface ImagesDataProps {
  bucket: string
  inStack: boolean
}

function ImagesData({ bucket, inStack }: ImagesDataProps) {
  const s3 = AWS.S3.use()
  const req = APIConnector.use()
  const { result } = useData(requests.bucketImgs, { req, s3, bucket, inStack })
  return AsyncResult.case(
    {
      Ok: (images: Model.S3.S3ObjectLocation[]) =>
        images.length ? <Gallery images={images} /> : null,
      _: () => null,
    },
    result,
  )
}

interface ImagesProps {
  bucket: string
}

export default function Images({ bucket }: ImagesProps) {
  const { bucket: bucketData } = GQL.useQueryS(BUCKET_QUERY, { bucket })
  const inStack = !!bucketData
  const { prefs } = BucketPreferences.use()
  return BucketPreferences.Result.match(
    {
      Ok: ({ ui: { blocks } }) => {
        const { gallery } = blocks
        if (cfg.noOverviewImages || !gallery || !gallery.overview) return null
        return <ImagesData bucket={bucket} inStack={inStack} />
      },
      _: () => null,
    },
    prefs,
  )
}
