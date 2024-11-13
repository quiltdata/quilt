import type AWSSDK from 'aws-sdk'
import * as React from 'react'
import { useParams } from 'react-router-dom'
import * as M from '@material-ui/core'

import cfg from 'constants/config'
import type * as Model from 'model'
import * as APIConnector from 'utils/APIConnector'
import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import * as BucketPreferences from 'utils/BucketPreferences'
import Data from 'utils/Data'
import * as GQL from 'utils/GraphQL'
import * as LinkedData from 'utils/LinkedData'

import * as Gallery from '../Gallery'
import * as Summarize from '../Summarize'
import * as requests from '../requests'

import Header from './Header'
import BUCKET_CONFIG_QUERY from './gql/BucketConfig.generated'

interface BucketReadmes {
  forced?: Model.S3.S3ObjectLocation
  discovered: Model.S3.S3ObjectLocation[]
}

interface ReadmesProps {
  s3: AWSSDK.S3
  bucket: string
  overviewUrl: string | undefined | null
}

function Readmes({ s3, overviewUrl, bucket }: ReadmesProps) {
  return (
    // @ts-expect-error
    <Data fetch={requests.bucketReadmes} params={{ s3, overviewUrl, bucket }}>
      {AsyncResult.case({
        Ok: (rs: BucketReadmes) =>
          (rs.discovered.length > 0 || !!rs.forced) && (
            <>
              {!!rs.forced && (
                <Summarize.FilePreview
                  key="readme:forced"
                  headingOverride={false}
                  handle={rs.forced}
                  expanded
                />
              )}
              {rs.discovered.map((h) => (
                // @ts-expect-error
                <Summarize.FilePreview
                  key={`readme:${h.bucket}/${h.key}`}
                  handle={h}
                  expanded
                />
              ))}
            </>
          ),
        _: () => <Summarize.FilePreviewSkel key="readme:skeleton" />,
      })}
    </Data>
  )
}

interface ImgsProps {
  s3: AWSSDK.S3
  bucket: string
  overviewUrl: string | undefined | null
  inStack: boolean
}

function Imgs({ s3, overviewUrl, inStack, bucket }: ImgsProps) {
  const req = APIConnector.use()
  return (
    // @ts-expect-error
    <Data fetch={requests.bucketImgs} params={{ req, s3, overviewUrl, inStack, bucket }}>
      {AsyncResult.case({
        Ok: (images: Model.S3.S3ObjectLocation[]) =>
          images.length ? <Gallery.Thumbnails images={images} /> : null,
        _: () => <Gallery.Skeleton />,
      })}
    </Data>
  )
}

interface ThumbnailsWrapperProps extends ImgsProps {
  preferences?:
    | false
    | {
        overview: boolean
        summarize: boolean
      }
}

function ThumbnailsWrapper({
  s3,
  overviewUrl,
  inStack,
  bucket,
  preferences: galleryPrefs,
}: ThumbnailsWrapperProps) {
  if (cfg.noOverviewImages || !galleryPrefs) return null
  if (!galleryPrefs.overview) return null
  return (
    // @ts-expect-error
    <Data fetch={requests.ensureQuiltSummarizeIsPresent} params={{ s3, bucket }}>
      {AsyncResult.case({
        Ok: (h?: Model.S3.S3ObjectLocation) =>
          (!h || galleryPrefs.summarize) && (
            <Imgs {...{ s3, bucket, inStack, overviewUrl }} />
          ),
        Err: () => <Imgs {...{ s3, bucket, inStack, overviewUrl }} />,
        Pending: () => <Gallery.Skeleton />,
        _: () => null,
      })}
    </Data>
  )
}

export default function Overview() {
  const { bucket } = useParams<{ bucket: string }>()

  const s3 = AWS.S3.use()
  const { bucketConfig } = GQL.useQueryS(BUCKET_CONFIG_QUERY, { bucket })
  const inStack = !!bucketConfig
  const overviewUrl = bucketConfig?.overviewUrl
  const description = bucketConfig?.description
  const prefs = BucketPreferences.use()
  return (
    <M.Box pb={{ xs: 0, sm: 4 }} mx={{ xs: -2, sm: 0 }} position="relative" zIndex={1}>
      {inStack && (
        <React.Suspense fallback={null}>
          <LinkedData.BucketData bucket={bucket} />
        </React.Suspense>
      )}
      {bucketConfig ? (
        <Header {...{ s3, bucket, overviewUrl, description }} />
      ) : (
        <M.Box
          pt={2}
          pb={{ xs: 2, sm: 0 }}
          px={{ xs: 2, sm: 0 }}
          textAlign={{ xs: 'center', sm: 'left' }}
        >
          <M.Typography variant="h5">{bucket}</M.Typography>
        </M.Box>
      )}
      <Readmes {...{ s3, bucket, overviewUrl }} />
      {BucketPreferences.Result.match(
        {
          Ok: ({ ui: { blocks } }) => (
            <ThumbnailsWrapper
              {...{ s3, bucket, inStack, overviewUrl, preferences: blocks.gallery }}
            />
          ),
          Pending: () => <Gallery.Skeleton />,
          Init: () => null,
        },
        prefs,
      )}
      <Summarize.SummaryRoot {...{ s3, bucket, inStack, overviewUrl }} />
    </M.Box>
  )
}
