import { basename } from 'path'

import cx from 'classnames'
import * as React from 'react'
import * as R from 'ramda'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'

import * as Pagination from 'components/Pagination'
import Thumbnail from 'components/Thumbnail'
import Skel from 'components/Skeleton'
import AsyncResult from 'utils/AsyncResult'
import Data from 'utils/Data'
import * as LogicalKeyResolver from 'utils/LogicalKeyResolver'
import * as NamedRoutes from 'utils/NamedRoutes'

import type * as SummaryTypes from 'components/Preview/loaders/summarize'

import type { GalleryItem } from './GallerySource'

const useImageGridStyles = M.makeStyles((t) => ({
  root: {
    display: 'grid',
    gridAutoRows: 'max-content',
    gridColumnGap: t.spacing(2),
    gridRowGap: t.spacing(2),
    gridTemplateColumns: '1fr',
    [t.breakpoints.up('sm')]: {
      gridTemplateColumns: '1fr 1fr 1fr',
    },
    [t.breakpoints.up('md')]: {
      gridTemplateColumns: '1fr 1fr 1fr 1fr',
    },
    [t.breakpoints.up('lg')]: {
      gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr',
    },
  },
}))

interface ImageGridProps {
  columns?: number
}

function ImageGrid({ children, columns }: React.PropsWithChildren<ImageGridProps>) {
  const classes = useImageGridStyles()
  const style = React.useMemo(
    () =>
      columns ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined,
    [columns],
  )
  return (
    <div className={classes.root} style={style}>
      {children}
    </div>
  )
}

const useThumbnailsStyles = M.makeStyles((t) => ({
  galleryFrame: {
    alignItems: 'center',
    display: 'flex',
    position: 'relative',
  },
  galleryGrid: {
    flex: 1,
    minWidth: 0,
  },
  galleryArrow: {
    zIndex: 1,
  },
  galleryArrowOverlay: {
    backgroundColor: t.palette.background.paper,
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    '&:hover': {
      backgroundColor: t.palette.background.paper,
    },
  },
  galleryArrowInside: {
    margin: t.spacing(0, 1),
  },
  galleryArrowOutside: {
    margin: t.spacing(0, 2),
  },
  galleryArrowPrevOverlay: {
    left: t.spacing(-1.5),
  },
  galleryArrowNextOverlay: {
    right: t.spacing(-1.5),
  },
  button: {
    display: 'block',
    overflow: 'hidden',
    width: '100%',
    textAlign: 'inherit',
  },
  img: {
    display: 'block',
    marginLeft: 'auto',
    marginRight: 'auto',
    maxWidth: '100%',
  },
  cover: {
    height: 180,
    objectFit: 'cover',
    width: '100%',
  },
  contain: {
    maxHeight: 180,
    objectFit: 'contain',
  },
  caption: {
    ...t.typography.caption,
    display: 'block',
    marginTop: t.spacing(0.5),
    overflowWrap: 'break-word',
    textAlign: 'center',
  },
}))

const useLightboxStyles = M.makeStyles((t) => ({
  paper: {
    backgroundColor: t.palette.background.default,
  },
  content: {
    alignItems: 'center',
    display: 'flex',
    minHeight: '70vh',
    position: 'relative',
  },
  imageWrap: {
    flex: 1,
    minWidth: 0,
    textAlign: 'center',
  },
  image: {
    maxHeight: '70vh',
    maxWidth: '100%',
  },
  imageZoomed: {
    cursor: 'zoom-out',
    transform: 'scale(1.5)',
  },
  nav: {
    zIndex: 1,
  },
  navOverlay: {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
  },
  navInside: {
    margin: t.spacing(0, 1),
  },
  navOutside: {
    margin: t.spacing(0, 2),
  },
  prevOverlay: {
    left: t.spacing(1),
  },
  nextOverlay: {
    right: t.spacing(1),
  },
  footer: {
    alignItems: 'center',
    display: 'flex',
    gap: t.spacing(1),
    justifyContent: 'space-between',
    padding: t.spacing(1, 3, 2),
  },
  footerText: {
    minWidth: 0,
  },
}))

type ImageLike = LogicalKeyResolver.S3SummarizeHandle | GalleryItem
type MakeURL = (h: LogicalKeyResolver.S3SummarizeHandle) => RRDom.LinkProps['to']

interface ThumbnailsProps {
  arrows?: SummaryTypes.GalleryArrows
  captions?: SummaryTypes.GalleryCaptions
  columns?: number
  counter?: boolean
  description?: React.ReactNode
  emptyMessage?: React.ReactNode
  fullscreen?: boolean
  images: ImageLike[]
  mkUrl?: MakeURL
  pageSize?: number
  rows?: number
  thumbnailFit?: SummaryTypes.GalleryThumbnailFit
  title?: React.ReactNode
  zoom?: boolean
}

function isGalleryItem(image: ImageLike): image is GalleryItem {
  return !!(image as GalleryItem).handle
}

function getHandle(image: ImageLike): LogicalKeyResolver.S3SummarizeHandle {
  return isGalleryItem(image) ? image.handle : image
}

function getPath(image: ImageLike): string {
  const handle = getHandle(image)
  return isGalleryItem(image) ? image.path : handle.logicalKey || handle.key
}

function getCaption(
  image: ImageLike,
  captions: SummaryTypes.GalleryCaptions | undefined,
): string {
  if (isGalleryItem(image)) return image.caption
  const path = getPath(image)
  switch (captions || 'none') {
    case 'filename':
      return basename(path)
    case 'path':
      return path
    default:
      return ''
  }
}

const useGallerySectionStyles = M.makeStyles((t) => ({
  root: {
    position: 'relative',
    zIndex: 1,
    [t.breakpoints.down('xs')]: {
      borderRadius: 0,
    },
    [t.breakpoints.up('sm')]: {
      marginTop: t.spacing(2),
    },
  },
  content: {
    [t.breakpoints.down('xs')]: {
      padding: t.spacing(1),
      paddingTop: t.spacing(2),
    },
    [t.breakpoints.up('sm')]: {
      padding: t.spacing(2),
    },
  },
  footer: {
    borderTop: `1px solid ${t.palette.divider}`,
    display: 'flex',
    justifyContent: 'flex-end',
    [t.breakpoints.down('xs')]: {
      padding: t.spacing(0.25, 1),
    },
    [t.breakpoints.up('sm')]: {
      padding: t.spacing(0.25, 2),
    },
  },
  description: {
    ...t.typography.body2,
  },
  heading: {
    marginBottom: t.spacing(1),
    [t.breakpoints.up('sm')]: {
      marginBottom: t.spacing(2),
    },
  },
}))

interface GallerySectionProps {
  description?: React.ReactNode
  footer?: React.ReactNode
  heading?: React.ReactNode
}

function GallerySection({
  children,
  description,
  footer,
  heading,
}: React.PropsWithChildren<GallerySectionProps>) {
  const classes = useGallerySectionStyles()
  return (
    <M.Paper className={classes.root}>
      <div className={classes.content}>
        {!!heading && (
          <M.Typography className={classes.heading} variant="h5">
            {heading}
          </M.Typography>
        )}
        {!!description && <div className={classes.description}>{description}</div>}
        {children}
      </div>
      {footer && <div className={classes.footer}>{footer}</div>}
    </M.Paper>
  )
}

interface HandleResolverProps {
  handle: LogicalKeyResolver.S3SummarizeHandle
  children: (r: $TSFixMe) => React.ReactNode
}

function HandleResolver({ handle, children }: HandleResolverProps) {
  const resolve = LogicalKeyResolver.use()
  if (resolve && handle.logicalKey && !handle.key) {
    return (
      // @ts-expect-error
      <Data fetch={resolve} params={handle.logicalKey}>
        {children}
      </Data>
    )
  }
  return <>{children(AsyncResult.Ok(handle))}</>
}

function Lightbox({
  active,
  arrows = 'overlay',
  counter = true,
  fullscreen,
  images,
  mkUrl,
  onClose,
  onSelect,
  zoom,
}: {
  active: number | null
  arrows?: SummaryTypes.GalleryArrows
  counter?: boolean
  fullscreen?: boolean
  images: ImageLike[]
  mkUrl?: MakeURL
  onClose: () => void
  onSelect: (index: number) => void
  zoom?: boolean
}) {
  const classes = useLightboxStyles()
  const { urls } = NamedRoutes.use()
  const [zoomed, setZoomed] = React.useState(false)
  const activeImage = active == null ? null : images[active]
  const activeHandle = activeImage && getHandle(activeImage)
  const caption = activeImage ? getCaption(activeImage, 'filename') : ''
  const canNavigate = images.length > 1 && arrows !== 'none'

  const move = React.useCallback(
    (delta: number) => {
      if (active == null || !images.length) return
      onSelect((active + delta + images.length) % images.length)
    },
    [active, images.length, onSelect],
  )

  React.useEffect(() => {
    setZoomed(false)
  }, [active])

  React.useEffect(() => {
    if (active == null) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        move(-1)
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        move(1)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active, move, onClose])

  if (!activeHandle) return null

  const fileUrl = mkUrl
    ? mkUrl(activeHandle)
    : urls.bucketFile(activeHandle.bucket, activeHandle.key, {
        version: activeHandle.version,
      })

  let navClass = classes.navOverlay
  if (arrows === 'outside') navClass = classes.navOutside
  if (arrows === 'inside') navClass = classes.navInside

  const navButton = (direction: -1 | 1) => (
    <M.IconButton
      aria-label={direction < 0 ? 'Previous image' : 'Next image'}
      className={cx(
        classes.nav,
        navClass,
        arrows === 'overlay' &&
          (direction < 0 ? classes.prevOverlay : classes.nextOverlay),
      )}
      color="primary"
      onClick={() => move(direction)}
    >
      <M.Icon>{direction < 0 ? 'chevron_left' : 'chevron_right'}</M.Icon>
    </M.IconButton>
  )

  return (
    <M.Dialog
      open
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      fullScreen={fullscreen}
      aria-label="Image gallery lightbox"
      classes={{ paper: classes.paper }}
    >
      <M.DialogTitle disableTypography>
        <M.Box display="flex" alignItems="center">
          <M.Typography variant="h6">{caption || 'Image preview'}</M.Typography>
          <M.IconButton aria-label="Close image preview" onClick={onClose}>
            <M.Icon>close</M.Icon>
          </M.IconButton>
        </M.Box>
      </M.DialogTitle>
      <M.DialogContent className={classes.content}>
        {canNavigate && arrows === 'outside' && navButton(-1)}
        {canNavigate && arrows !== 'outside' && navButton(-1)}
        <div className={classes.imageWrap}>
          <HandleResolver handle={activeHandle}>
            {AsyncResult.case({
              _: () => null,
              Ok: (resolved: LogicalKeyResolver.S3SummarizeHandle) => (
                <Thumbnail
                  handle={resolved}
                  size="lg"
                  className={cx(classes.image, zoomed && classes.imageZoomed)}
                  alt={caption}
                  title={caption}
                  onClick={() => zoom && setZoomed((value) => !value)}
                />
              ),
            })}
          </HandleResolver>
        </div>
        {canNavigate && arrows !== 'outside' && navButton(1)}
        {canNavigate && arrows === 'outside' && navButton(1)}
      </M.DialogContent>
      <div className={classes.footer}>
        <div className={classes.footerText}>
          {counter && (
            <M.Typography variant="body2">
              {(active || 0) + 1} of {images.length}
            </M.Typography>
          )}
        </div>
        <M.Button component={RRDom.Link} to={fileUrl} onClick={onClose}>
          Open file
        </M.Button>
        {zoom && (
          <M.Button onClick={() => setZoomed((value) => !value)}>
            {zoomed ? 'Reset zoom' : 'Zoom'}
          </M.Button>
        )}
      </div>
    </M.Dialog>
  )
}

function PageIndicator({ page, pages }: { page: number; pages: number }) {
  return (
    <M.Box display="flex" alignItems="center" px={1.5} py={1}>
      {page} of {pages}
    </M.Box>
  )
}

export function Thumbnails({
  arrows,
  captions,
  columns,
  counter,
  description,
  emptyMessage = 'No images found',
  fullscreen,
  images,
  mkUrl,
  pageSize,
  rows,
  thumbnailFit = 'contain',
  title,
  zoom,
}: ThumbnailsProps) {
  const classes = useThumbnailsStyles()

  const scrollRef = React.useRef<HTMLDivElement | null>(null)
  const scroll = React.useCallback(
    (prev) => {
      if (prev && scrollRef.current) scrollRef.current.scrollIntoView()
    },
    [scrollRef],
  )

  const perPage = pageSize || (columns && rows ? columns * rows : 25)
  const shouldUseSidePager = !!arrows && arrows !== 'none'
  const pagination = Pagination.use(images, {
    perPage,
    onChange: shouldUseSidePager ? undefined : scroll,
  })
  const [active, setActive] = React.useState<number | null>(null)
  const useSidePager = shouldUseSidePager && pagination.pages > 1

  const heading = title || (
    <>
      Images ({pagination.from}&ndash;{Math.min(pagination.to, images.length)} of{' '}
      {images.length})
    </>
  )

  if (!images.length) {
    return (
      <GallerySection heading={title || 'Images'} description={description}>
        <M.Typography>{emptyMessage}</M.Typography>
      </GallerySection>
    )
  }

  return (
    <GallerySection
      heading={heading}
      description={description}
      footer={
        pagination.pages > 1 &&
        (useSidePager ? (
          <PageIndicator page={pagination.page} pages={pagination.pages} />
        ) : (
          <Pagination.Controls {...pagination} />
        ))
      }
    >
      <div ref={scrollRef} />
      <div className={classes.galleryFrame}>
        {useSidePager && (
          <M.IconButton
            aria-label="Previous gallery page"
            className={cx(
              classes.galleryArrow,
              arrows === 'overlay' && classes.galleryArrowOverlay,
              arrows === 'overlay' && classes.galleryArrowPrevOverlay,
              arrows === 'inside' && classes.galleryArrowInside,
              arrows === 'outside' && classes.galleryArrowOutside,
            )}
            disabled={pagination.page <= 1}
            onClick={pagination.prevPage}
          >
            <M.Icon>chevron_left</M.Icon>
          </M.IconButton>
        )}
        <div className={classes.galleryGrid}>
          <ImageGrid columns={columns}>
            {pagination.paginated.map((image: ImageLike, pageIndex: number) => {
              const handle = getHandle(image)
              const caption = getCaption(image, captions)
              const index = (pagination.from || 1) - 1 + pageIndex
              return (
                <M.ButtonBase
                  key={handle.logicalKey || handle.key}
                  className={classes.button}
                  onClick={() => setActive(index)}
                >
                  <HandleResolver handle={handle}>
                    {AsyncResult.case({
                      _: () => null,
                      Ok: (resolved: LogicalKeyResolver.S3SummarizeHandle) => (
                        <>
                          <Thumbnail
                            handle={resolved}
                            className={cx(
                              classes.img,
                              thumbnailFit === 'cover' ? classes.cover : classes.contain,
                            )}
                            alt={caption || basename(handle.logicalKey || handle.key)}
                            title={caption || basename(handle.logicalKey || handle.key)}
                          />
                          {!!caption && (
                            <span className={classes.caption}>{caption}</span>
                          )}
                        </>
                      ),
                    })}
                  </HandleResolver>
                </M.ButtonBase>
              )
            })}
          </ImageGrid>
        </div>
        {useSidePager && (
          <M.IconButton
            aria-label="Next gallery page"
            className={cx(
              classes.galleryArrow,
              arrows === 'overlay' && classes.galleryArrowOverlay,
              arrows === 'overlay' && classes.galleryArrowNextOverlay,
              arrows === 'inside' && classes.galleryArrowInside,
              arrows === 'outside' && classes.galleryArrowOutside,
            )}
            disabled={pagination.page >= pagination.pages}
            onClick={pagination.nextPage}
          >
            <M.Icon>chevron_right</M.Icon>
          </M.IconButton>
        )}
      </div>
      <Lightbox
        active={active}
        arrows={arrows}
        counter={counter}
        fullscreen={fullscreen}
        images={images}
        mkUrl={mkUrl}
        onClose={() => setActive(null)}
        onSelect={setActive}
        zoom={zoom}
      />
    </GallerySection>
  )
}

export function Skeleton() {
  return (
    <GallerySection
      key="thumbs:skel"
      heading={<Skel borderRadius="borderRadius" width={200} />}
    >
      <ImageGrid>
        {R.times(
          (i) => (
            <Skel key={`thumbs:skel:${i}`} height={200} />
          ),
          9,
        )}
      </ImageGrid>
    </GallerySection>
  )
}
