import { basename, join } from 'path'

import * as R from 'ramda'
import * as React from 'react'
import { Link, useHistory } from 'react-router-dom'
import * as M from '@material-ui/core'

import * as Pagination from 'components/Pagination'
import * as Preview from 'components/Preview'
import Thumbnail, { SUPPORTED_EXTENSIONS } from 'components/Thumbnail'
import AsyncResult from 'utils/AsyncResult'
import Data from 'utils/Data'
import * as LogicalKeyResolver from 'utils/LogicalKeyResolver'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import { getBasename } from 'utils/s3paths'

import * as Summarize from './Summarize'

const useAddReadmeSectionStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    justifyContent: 'flex-end',
    margin: t.spacing(2, 0),
  },
}))

const variants = ['README.md', 'README.txt', 'README']

function AddReadmeSection({ packageHandle: { bucket, name } }) {
  const classes = useAddReadmeSectionStyles()
  const { urls } = NamedRoutes.use()
  const history = useHistory()
  const toConfig = React.useCallback(
    (index) => {
      const next = urls.bucketPackageDetail(bucket, name, { action: 'revisePackage' })
      return urls.bucketFile(bucket, join(name, variants[index]), {
        add: true,
        edit: true,
        next,
      })
    },
    [bucket, name, urls],
  )
  const [selected, setSelected] = React.useState(0)
  const handleClick = React.useCallback(() => {
    const url = toConfig(selected)
    history.push(url)
  }, [history, toConfig, selected])
  const options = React.useMemo(() => variants.map((x) => `Add ${x}`), [])
  return (
    <div className={classes.root}>
      <SplitButton options={options} onClick={handleClick} onChange={setSelected}>
        {options[selected]}
      </SplitButton>
    </div>
  )
}

function SplitButton({ onClick, children, onChange, options }) {
  const anchorRef = React.useRef(null)
  const [anchorEl, setAnchorEl] = React.useState(null)
  const handleSelect = React.useCallback(
    (index) => () => {
      onChange(index)
      setAnchorEl(null)
    },
    [onChange],
  )
  return (
    <>
      <M.ButtonGroup ref={anchorRef} color="primary" size="small" variant="contained">
        <M.Button onClick={onClick}>{children}</M.Button>
        <M.Button onClick={() => setAnchorEl(anchorRef.current)}>
          <M.Icon>arrow_drop_down</M.Icon>
        </M.Button>
      </M.ButtonGroup>
      <M.Menu open={!!anchorEl} anchorEl={anchorEl} onClose={() => setAnchorEl(null)}>
        {options.map((option, i) => (
          <M.MenuItem onClick={handleSelect(i)}>{option}</M.MenuItem>
        ))}
      </M.Menu>
    </>
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

function HandleResolver({ handle, children }) {
  const resolve = LogicalKeyResolver.use()
  if (resolve && handle.logicalKey && !handle.key) {
    return (
      <Data fetch={resolve} params={handle.logicalKey}>
        {children}
      </Data>
    )
  }
  return children(AsyncResult.Ok(handle))
}

const renderContents = (contents) => <M.Box mx="auto">{contents}</M.Box>

const previewOptions = { context: Preview.CONTEXT.LISTING }

function SummaryItemFile({ handle, name, mkUrl }) {
  const withData = (callback) => (
    <HandleResolver handle={handle}>
      {AsyncResult.case({
        Err: (e, { fetch }) =>
          Preview.PreviewError.Unexpected({ handle, retry: fetch, originalError: e }),
        Ok: (resolved) => Preview.load(resolved, callback, previewOptions),
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

const useThumbnailsStyles = M.makeStyles((t) => ({
  container: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  link: {
    flexBasis: '19%',
    marginBottom: t.spacing(2),
  },
  img: {
    display: 'block',
    marginLeft: 'auto',
    marginRight: 'auto',
    maxWidth: '100%',
  },
  filler: {
    flexBasis: '19%',

    '&::after': {
      content: '""',
    },
  },
}))

function Thumbnails({ images, mkUrl }) {
  const classes = useThumbnailsStyles()

  const scrollRef = React.useRef(null)
  const scroll = React.useCallback(
    (prev) => {
      if (prev && scrollRef.current) scrollRef.current.scrollIntoView()
    },
    [scrollRef],
  )

  const pagination = Pagination.use(images, { perPage: 25, onChange: scroll })

  return (
    <Container>
      <Header>
        Images ({pagination.from}&ndash;{pagination.to} of {images.length})
      </Header>
      <div ref={scrollRef} />
      <M.CardContent className={classes.container}>
        {pagination.paginated.map((i) => (
          <Link key={i.logicalKey || i.key} to={mkUrl(i)} className={classes.link}>
            <HandleResolver handle={i}>
              {AsyncResult.case({
                _: () => null,
                Ok: (resolved) => (
                  <Thumbnail
                    handle={resolved}
                    className={classes.img}
                    alt={basename(i.logicalKey || i.key)}
                    title={basename(i.logicalKey || i.key)}
                  />
                ),
              })}
            </HandleResolver>
          </Link>
        ))}
        {R.times(
          (i) => (
            <div className={classes.filler} key={`__filler${i}`} />
          ),
          (5 - (pagination.paginated.length % 5)) % 5,
        )}
      </M.CardContent>
      {pagination.pages > 1 && (
        <M.Box>
          <M.Divider />
          <M.Box display="flex" justifyContent="flex-end" px={2} py={0.25}>
            <Pagination.Controls {...pagination} />
          </M.Box>
        </M.Box>
      )}
    </Container>
  )
}

// files: Array of s3 handles
export default function BucketSummary({ files, mkUrl: mkUrlProp, packageHandle, path }) {
  const { urls } = NamedRoutes.use()
  const mkUrl = React.useCallback(
    (handle) =>
      mkUrlProp
        ? mkUrlProp(handle)
        : urls.bucketFile(handle.bucket, handle.key, { version: handle.version }),
    [mkUrlProp, urls],
  )
  const { readme, images, summarize } = extractSummary(files)

  return (
    <>
      {readme && (
        <SummaryItemFile
          title={basename(readme.logicalKey || readme.key)}
          handle={readme}
          mkUrl={mkUrl}
        />
      )}
      {!readme && !path && !!packageHandle && (
        <AddReadmeSection packageHandle={packageHandle} />
      )}
      {!!images.length && <Thumbnails {...{ images, mkUrl }} />}
      {summarize && (
        <Summarize.SummaryNested
          handle={summarize}
          mkUrl={mkUrl}
          packageHandle={packageHandle}
        />
      )}
    </>
  )
}
