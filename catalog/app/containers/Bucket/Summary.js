import { basename } from 'path'

import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as Buttons from 'components/Buttons'
import * as FileEditor from 'components/FileEditor'
import * as Preview from 'components/Preview'
import { SUPPORTED_EXTENSIONS } from 'components/Thumbnail'
import AsyncResult from 'utils/AsyncResult'
import * as BucketPreferences from 'utils/BucketPreferences'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import { getBasename } from 'utils/s3paths'

import * as Gallery from './Gallery'
import * as Summarize from './Summarize'

const useAddReadmeSectionStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    justifyContent: 'flex-end',
    margin: t.spacing(2, 0),
  },
}))

function AddReadmeSection({ packageHandle, path }) {
  const prompt = FileEditor.useCreateFileInPackage(packageHandle, path)
  const classes = useAddReadmeSectionStyles()
  return (
    <div className={classes.root}>
      {prompt.render()}
      <M.Button color="primary" size="small" variant="contained" onClick={prompt.open}>
        Add README
      </M.Button>
    </div>
  )
}

const README_RE = /^readme\.md$/i
const SUMMARIZE_RE = /^quilt_summarize\.json$/i

const findFile = (re) => R.find((f) => re.test(getBasename(f.logicalKey || f.key)))

const extractSummary = R.applySpec({
  readme: findFile(README_RE),
  summarize: findFile(SUMMARIZE_RE),
  images: R.filter(
    (f) =>
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

const Header = ({ children }) => (
  <M.CardHeader title={<M.Typography variant="h5">{children}</M.Typography>} />
)

const renderContents = (contents) => <M.Box mx="auto">{contents}</M.Box>

const previewOptions = { context: Preview.CONTEXT.LISTING }

function SummaryItemFile({ handle, name, mkUrl }) {
  const withData = (callback) => (
    <Summarize.HandleResolver handle={handle}>
      {AsyncResult.case({
        Err: (e, { fetch }) =>
          Preview.PreviewError.Unexpected({ handle, retry: fetch, originalError: e }),
        Ok: (resolved) => Preview.load(resolved, callback, previewOptions),
        _: callback,
      })}
    </Summarize.HandleResolver>
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

function ThumbnailsWrapper({
  preferences: galleryPrefs,
  images,
  mkUrl,
  inPackage,
  hasSummarize,
}) {
  if (!images.length || !galleryPrefs) return null
  if (!inPackage && !galleryPrefs.files) return null
  if (inPackage && !galleryPrefs.packages) return null
  if (hasSummarize && !galleryPrefs.summarize) return null
  return <Gallery.Thumbnails {...{ images, mkUrl }} />
}

// files: Array of s3 handles
export default function BucketSummary({ files, mkUrl: mkUrlProp, packageHandle, path }) {
  const { urls } = NamedRoutes.use()
  const prefs = BucketPreferences.use()
  const mkUrl = React.useCallback(
    (handle) =>
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
            !readme &&
            !path &&
            !!packageHandle &&
            !!actions.revisePackage && (
              <AddReadmeSection packageHandle={packageHandle} path={path} />
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
          handle={summarize}
          mkUrl={mkUrl}
          packageHandle={packageHandle}
        />
      )}
    </Summarize.FileThemeContext.Provider>
  )
}
