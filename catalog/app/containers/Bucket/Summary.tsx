import { basename } from 'path'

import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as Buttons from 'components/Buttons'
import * as Preview from 'components/Preview'
import { SUPPORTED_EXTENSIONS } from 'components/Thumbnail'
import type * as Model from 'model'
import AsyncResult from 'utils/AsyncResult'
import * as BucketPreferences from 'utils/BucketPreferences'
import type * as LogicalKeyResolver from 'utils/LogicalKeyResolver'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import type { PackageHandle } from 'utils/packageHandle'
import { getBasename } from 'utils/s3paths'

import * as Gallery from './Gallery'
import * as Summarize from './Summarize'

interface SummaryFile extends LogicalKeyResolver.S3SummarizeHandle {
  archived?: boolean
  etag?: string
}

interface ExtractedSummary {
  readme?: SummaryFile
  summarize?: SummaryFile
  images: SummaryFile[]
}

const README_RE = /^readme\.md$/i
const SUMMARIZE_RE = /^quilt_summarize\.json$/i

const findFile = (re: RegExp) =>
  R.find<SummaryFile>((f) => re.test(getBasename(f.logicalKey || f.key)))

const extractSummary = R.applySpec<ExtractedSummary>({
  readme: findFile(README_RE),
  summarize: findFile(SUMMARIZE_RE),
  images: R.filter(
    (f: SummaryFile) =>
      !f.archived &&
      SUPPORTED_EXTENSIONS.some((ext) =>
        (f.logicalKey || f.key).toLowerCase().endsWith(ext),
      ),
  ),
})

const Container = M.styled(M.Card)(({ theme: t }) => ({
  position: 'relative',
  zIndex: 1,
  [t.breakpoints.down('xs')]: {
    borderRadius: 0,
  },
  [t.breakpoints.up('sm')]: {
    marginTop: t.spacing(2),
  },
}))

const Header = ({ children }: React.PropsWithChildren<{}>) => (
  <M.CardHeader title={<M.Typography variant="h5">{children}</M.Typography>} />
)

const renderContents = (contents: React.ReactNode) => <M.Box mx="auto">{contents}</M.Box>

const previewOptions = { context: Preview.CONTEXT.LISTING }

const HandleResolver = Summarize.HandleResolver as React.ComponentType<any>

interface SummaryItemFileProps {
  handle: SummaryFile
  name?: React.ReactNode
  mkUrl: Summarize.MakeURL
  // accepted but unused by this component (preserved from the JS call site)
  title?: React.ReactNode
}

function SummaryItemFile({ handle, name, mkUrl }: SummaryItemFileProps) {
  const withData = (callback: $TSFixMe) => (
    <HandleResolver handle={handle}>
      {AsyncResult.case({
        Err: (e: $TSFixMe, { fetch }: $TSFixMe) =>
          Preview.PreviewError.Unexpected({ handle, retry: fetch, originalError: e }),
        Ok: (resolved: $TSFixMe) => Preview.load(resolved, callback, previewOptions),
        _: callback,
      })}
    </HandleResolver>
  )

  return (
    <Container>
      <Header>
        <StyledLink to={mkUrl(handle)}>
          {name || basename(handle.logicalKey || handle.key)}
        </StyledLink>
      </Header>
      <M.CardContent>{withData(Preview.display({ renderContents }))}</M.CardContent>
    </Container>
  )
}

interface ThumbnailsWrapperProps {
  preferences?: { files: boolean; packages: boolean; summarize: boolean } | false
  images: SummaryFile[]
  mkUrl: Summarize.MakeURL
  inPackage: boolean
  hasSummarize: boolean
}

function ThumbnailsWrapper({
  preferences: galleryPrefs,
  images,
  mkUrl,
  inPackage,
  hasSummarize,
}: ThumbnailsWrapperProps) {
  if (!images.length || !galleryPrefs) return null
  if (!inPackage && !galleryPrefs.files) return null
  if (inPackage && !galleryPrefs.packages) return null
  if (hasSummarize && !galleryPrefs.summarize) return null
  return <Gallery.Thumbnails {...{ images, mkUrl }} />
}

interface BucketSummaryProps {
  // files: Array of s3 handles
  files: SummaryFile[]
  mkUrl?: Summarize.MakeURL
  packageHandle?: PackageHandle
  path?: string
}

export default function BucketSummary({
  files,
  mkUrl: mkUrlProp,
  packageHandle,
  path,
}: BucketSummaryProps) {
  const { urls } = NamedRoutes.use()
  const { prefs } = BucketPreferences.use()
  const mkUrl = React.useCallback(
    (handle: Model.S3.S3ObjectLocation) =>
      mkUrlProp
        ? mkUrlProp(handle)
        : urls.bucketFile(handle.bucket, handle.key, { version: handle.version }),
    [mkUrlProp, urls],
  )
  const { readme, images, summarize } = extractSummary(files)

  return (
    <Summarize.FileThemeContext.Provider value={Summarize.FileThemes.Nested}>
      {readme && (
        <SummaryItemFile
          title={basename(readme.logicalKey || readme.key)}
          handle={readme}
          mkUrl={mkUrl}
        />
      )}
      {BucketPreferences.Result.match(
        {
          Ok: ({ ui: { actions } }) =>
            (!readme || !summarize) &&
            !path &&
            !!packageHandle &&
            !!actions.revisePackage && (
              <Summarize.ConfigureAppearance
                hasReadme={!!readme}
                hasSummarizeJson={!!summarize}
                packageHandle={packageHandle}
                path={path || ''}
              />
            ),
          Pending: () => <Buttons.Skeleton size="small" />,
          Init: () => null,
        },
        prefs,
      )}
      {BucketPreferences.Result.match(
        {
          Ok: ({ ui: { blocks } }) => (
            <ThumbnailsWrapper
              {...{
                images,
                mkUrl,
                preferences: blocks.gallery,
                inPackage: !!packageHandle,
                hasSummarize: !!summarize,
              }}
            />
          ),
          Pending: () => <Gallery.Skeleton />,
          Init: () => null,
        },
        prefs,
      )}
      {summarize && (
        <Summarize.SummaryNested
          handle={summarize as $TSFixMe}
          mkUrl={mkUrl}
          packageHandle={packageHandle as PackageHandle}
        />
      )}
    </Summarize.FileThemeContext.Provider>
  )
}
