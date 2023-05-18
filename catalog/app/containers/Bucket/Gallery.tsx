import { basename } from 'path'

import * as React from 'react'
import * as R from 'ramda'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'

import * as Pagination from 'components/Pagination'
import Thumbnail from 'components/Thumbnail'
import Skel from 'components/Skeleton'
import AsyncResult from 'utils/AsyncResult'
import * as LogicalKeyResolver from 'utils/LogicalKeyResolver'
import * as NamedRoutes from 'utils/NamedRoutes'

import * as Summarize from './Summarize'

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

function ImageGrid({ children }: React.PropsWithChildren<{}>) {
  const classes = useImageGridStyles()
  return <div className={classes.root}>{children}</div>
}

const useThumbnailsStyles = M.makeStyles({
  link: {
    overflow: 'hidden',
  },
  img: {
    display: 'block',
    marginLeft: 'auto',
    marginRight: 'auto',
    maxWidth: '100%',
  },
})

interface ThumbnailsProps {
  images: LogicalKeyResolver.S3SummarizeHandle[]
  mkUrl?: Summarize.MakeURL
}

export function Thumbnails({ images, mkUrl }: ThumbnailsProps) {
  const classes = useThumbnailsStyles()
  const { urls } = NamedRoutes.use()

  const scrollRef = React.useRef<HTMLDivElement | null>(null)
  const scroll = React.useCallback(
    (prev) => {
      if (prev && scrollRef.current) scrollRef.current.scrollIntoView()
    },
    [scrollRef],
  )

  const pagination = Pagination.use(images, { perPage: 25, onChange: scroll })

  return (
    <Summarize.Section
      heading={
        <>
          Images ({pagination.from}&ndash;{Math.min(pagination.to, images.length)} of{' '}
          {images.length})
        </>
      }
      footer={pagination.pages > 1 && <Pagination.Controls {...pagination} />}
    >
      <div ref={scrollRef} />
      <ImageGrid>
        {pagination.paginated.map((i: LogicalKeyResolver.S3SummarizeHandle) => (
          <RRDom.Link
            key={i.logicalKey || i.key}
            to={
              mkUrl ? mkUrl(i) : urls.bucketFile(i.bucket, i.key, { version: i.version })
            }
            className={classes.link}
          >
            {/* @ts-expect-error */}
            <Summarize.HandleResolver handle={i}>
              {AsyncResult.case({
                _: () => null,
                Ok: (resolved: LogicalKeyResolver.S3SummarizeHandle) => (
                  // @ts-expect-error
                  <Thumbnail
                    handle={resolved}
                    className={classes.img}
                    alt={basename(i.logicalKey || i.key)}
                    title={basename(i.logicalKey || i.key)}
                  />
                ),
              })}
            </Summarize.HandleResolver>
          </RRDom.Link>
        ))}
      </ImageGrid>
    </Summarize.Section>
  )
}

export function Skeleton() {
  return (
    <Summarize.Section key="thumbs:skel" heading={<Summarize.HeadingSkel />}>
      <ImageGrid>
        {R.times(
          (i) => (
            <Skel key={`thumbs:skel:${i}`} height={200} />
          ),
          9,
        )}
      </ImageGrid>
    </Summarize.Section>
  )
}
