import cx from 'classnames'
import * as dateFns from 'date-fns'
import invariant from 'invariant'
import * as jsonpath from 'jsonpath'
import * as R from 'ramda'
import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'

import * as Buttons from 'components/Buttons'
import JsonDisplay from 'components/JsonDisplay'
import Skeleton from 'components/Skeleton'
import Sparkline from 'components/Sparkline'
import * as BucketPreferences from 'utils/BucketPreferences'
import * as GQL from 'utils/GraphQL'
import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as SVG from 'utils/SVG'
import StyledLink from 'utils/StyledLink'
import * as Format from 'utils/format'
import { readableQuantity } from 'utils/string'
import { JsonRecord } from 'utils/types'
import usePrevious from 'utils/usePrevious'

import Pagination from '../Pagination'
import WithPackagesSupport from '../WithPackagesSupport'
import { displayError } from '../errors'

import * as UIModel from './UIModel'

const EXAMPLE_PACKAGE_URL = 'https://docs.quiltdata.com/walkthrough/editing-a-package'

function Counts({ counts, total }: UIModel.AccessCounts) {
  const [cursor, setCursor] = React.useState<number | null>(null)
  const t = M.useTheme()
  const xs = M.useMediaQuery(t.breakpoints.down('xs'))
  const sm = M.useMediaQuery(t.breakpoints.down('sm'))
  // eslint-disable-next-line no-nested-ternary
  const sparklineW = xs ? 176 : sm ? 300 : 400
  const sparklineH = xs ? 32 : 40
  return (
    <M.Box position="absolute" right={0} top={0} bottom={0}>
      <M.Box position="absolute" right={16} top={16} whiteSpace="nowrap">
        <M.Typography
          variant="body2"
          color={cursor === null ? 'textSecondary' : 'textPrimary'}
          component="span"
          noWrap
        >
          {cursor === null
            ? 'Total views'
            : dateFns.format(counts[cursor].date, `MMM do`)}
          :
        </M.Typography>
        <M.Box
          component="span"
          textAlign="right"
          ml={1}
          minWidth={30}
          display="inline-block"
        >
          <M.Typography
            variant="subtitle2"
            color={cursor === null ? 'textSecondary' : 'textPrimary'}
            component="span"
          >
            {readableQuantity(cursor === null ? total : counts[cursor].value)}
          </M.Typography>
        </M.Box>
      </M.Box>
      <Sparkline
        boxProps={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: sparklineW,
          height: sparklineH,
        }}
        data={R.pluck('value', counts)}
        onCursor={setCursor}
        width={sparklineW}
        height={sparklineH}
        pb={8}
        pt={5}
        px={10}
        extendL
        extendR
        stroke={SVG.Paint.Color(M.colors.blue[500])}
        fill={SVG.Paint.Server(
          <linearGradient>
            <stop offset="0" stopColor={fade(M.colors.blue[500], 0)} />
            <stop offset="30%" stopColor={fade(M.colors.blue[500], 0.3)} />
          </linearGradient>,
        )}
        contourThickness={1.5}
        cursorLineExtendUp={false}
        cursorCircleR={3}
        cursorCircleFill={SVG.Paint.Color(M.colors.common.white)}
      />
    </M.Box>
  )
}

const useRevisionAttributesStyles = M.makeStyles((t) => ({
  revisionsNumber: {
    ...t.typography.subtitle2,
    color: t.palette.text.secondary,
    position: 'relative',
    '&:hover': {
      color: t.palette.text.primary,
    },
  },
  updated: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
    position: 'relative',
    marginLeft: t.spacing(2),
  },
}))

interface RevisionAttributesProps {
  bucket: string
  name: string
  className: string
  revisions: {
    total: number
  }
  modified: Date
}

function RevisionAttributes({
  bucket,
  className,
  name,
  modified,
  revisions,
}: RevisionAttributesProps) {
  const classes = useRevisionAttributesStyles()
  const t = M.useTheme()
  const xs = M.useMediaQuery(t.breakpoints.down('xs'))
  const { urls } = NamedRoutes.use()
  return (
    <div className={className}>
      <RRDom.Link
        className={classes.revisionsNumber}
        to={urls.bucketPackageRevisions(bucket, name)}
      >
        {revisions.total}{' '}
        {xs ? (
          'Rev.'
        ) : (
          <Format.Plural value={revisions.total} one="Revision" other="Revisions" />
        )}
      </RRDom.Link>
      <span
        className={classes.updated}
        title={modified ? modified.toString() : undefined}
      >
        {xs ? 'Upd. ' : 'Updated '}
        {modified ? <Format.Relative value={modified} /> : '[unknown: see console]'}
      </span>
    </div>
  )
}

const useRevisionMetaStyles = M.makeStyles((t) => ({
  root: {
    borderTop: `1px solid ${t.palette.divider}`,
    padding: t.spacing(2),
    ...t.typography.body2,
  },
  section: {
    '& + &': {
      marginTop: t.spacing(1),
    },
  },
  sectionWithToggle: {
    marginLeft: '-5px',
  },
}))

interface RevisionMetaProps {
  revision: SelectiveMeta
}

function RevisionMeta({ revision }: RevisionMetaProps) {
  const classes = useRevisionMetaStyles()
  const { prefs } = BucketPreferences.use()
  return (
    <div className={classes.root}>
      {!!revision.message && <div className={classes.section}>{revision.message}</div>}
      {!!revision.userMeta && (
        <div className={classes.section}>
          {BucketPreferences.Result.match(
            {
              Ok: ({ ui: { packageDescription } }) =>
                packageDescription.userMetaMultiline ? (
                  Object.entries(revision.userMeta!).map(([name, value]) => (
                    <JsonDisplay
                      className={cx({
                        [classes.sectionWithToggle]: typeof value === 'object',
                      })}
                      key={`user-meta-section-${name}`}
                      name={name}
                      value={value}
                    />
                  ))
                ) : (
                  <JsonDisplay
                    className={classes.sectionWithToggle}
                    name="User metadata"
                    value={revision.userMeta}
                  />
                ),
              _: () => null,
            },
            prefs,
          )}
        </div>
      )}
    </div>
  )
}

function filterObjectByJsonPaths(obj: JsonRecord, jsonPaths: readonly string[]) {
  return jsonPaths.reduce(
    (acc, jPath) =>
      jsonpath
        .nodes(obj, jPath)
        .reduce((memo, { path, value }) => R.assocPath(path.slice(1), value, memo), acc),
    {},
  )
}

function usePackageDescription(
  name: string,
): BucketPreferences.PackagePreferences | null {
  const { prefs } = BucketPreferences.use()
  return React.useMemo(
    () =>
      BucketPreferences.Result.match(
        {
          Ok: ({ ui: { packageDescription } }) => {
            if (!packageDescription.packages) return null
            return (
              Object.entries(packageDescription.packages)
                .reverse() // The last found config wins
                .find(([nameRegex]) => new RegExp(nameRegex).test(name))?.[1] || {}
            )
          },
          _: () => null,
        },
        prefs,
      ),
    [name, prefs],
  )
}

interface SelectiveMeta {
  message: string | null
  userMeta: JsonRecord | null
}

function useSelectiveMeta(name: string, revision: SelectiveMeta | null) {
  // TODO: move visible meta calculation to the graphql
  const packageDescription = usePackageDescription(name)
  return React.useMemo(() => {
    const output: { message: string | null; userMeta: JsonRecord | null } = {
      message: null,
      userMeta: null,
    }
    try {
      if (!packageDescription) return null
      if (packageDescription.message && revision?.message) {
        output.message = revision.message
      }
      if (packageDescription.userMeta && revision?.userMeta) {
        const selectiveUserMeta = filterObjectByJsonPaths(
          revision.userMeta,
          packageDescription.userMeta,
        )
        if (!R.isEmpty(selectiveUserMeta)) {
          output.userMeta = selectiveUserMeta
        }
      }
      return output.message || output.userMeta ? output : null
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error)
      return null
    }
  }, [packageDescription, revision])
}

const usePackageStyles = M.makeStyles((t) => ({
  root: {
    [t.breakpoints.down('xs')]: {
      borderRadius: 0,
    },

    [t.breakpoints.up('sm')]: {
      marginTop: t.spacing(1),
    },
  },
  base: {
    padding: t.spacing(2),
    position: 'relative',
  },
  handleContainer: {
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 2,
    display: '-webkit-box',
    overflow: 'hidden',
    overflowWrap: 'break-word',
    paddingRight: t.spacing(21),
    textOverflow: 'ellipsis',
  },
  handle: {
    fontSize: t.typography.pxToRem(16),
    fontWeight: t.typography.fontWeightMedium,
    lineHeight: t.typography.pxToRem(20),
  },
  handleText: {
    position: 'relative',
  },
  handleClickArea: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,

    '$handle:hover &': {
      background: t.palette.action.hover,
    },
  },
  attributes: {
    marginTop: t.spacing(1),
  },
}))

function Package({
  name,
  modified,
  revisions,
  bucket,
  accessCounts,
  revision,
}: UIModel.PackageSelection) {
  const { urls } = NamedRoutes.use()
  const classes = usePackageStyles()
  const selectiveMeta = useSelectiveMeta(name, revision)
  return (
    <M.Paper className={classes.root}>
      <div className={classes.base}>
        <div className={classes.handleContainer}>
          <RRDom.Link
            className={classes.handle}
            to={urls.bucketPackageDetail(bucket, name)}
          >
            <span className={classes.handleClickArea} />
            <span className={classes.handleText}>{name}</span>
          </RRDom.Link>
        </div>
        <RevisionAttributes
          bucket={bucket}
          className={classes.attributes}
          modified={modified}
          name={name}
          revisions={revisions}
        />
        {!!accessCounts && <Counts {...accessCounts} />}
      </div>
      {!!selectiveMeta && <RevisionMeta revision={selectiveMeta} />}
    </M.Paper>
  )
}

function PackageSkel() {
  const classes = usePackageStyles()
  return (
    <M.Paper className={classes.root}>
      <M.Box p={2}>
        <Skeleton height={20} width="50%" borderRadius="borderRadius" />
        <Skeleton mt={1} height={20} width="70%" borderRadius="borderRadius" />
      </M.Box>
    </M.Paper>
  )
}

const useSortDropdownStyles = M.makeStyles((t) => ({
  root: {
    paddingBottom: t.spacing(1),
    paddingLeft: t.spacing(1.5),
    paddingTop: t.spacing(1),
    textTransform: 'none',
    ...t.typography.body1,
  },
}))

interface SortDropdownProps {
  value: UIModel.SortMode
  options: typeof UIModel.SORT_OPTIONS
  makeSortUrl: (mode: UIModel.SortMode) => string
}

function SortDropdown({ value, options, makeSortUrl }: SortDropdownProps) {
  const t = M.useTheme()
  const xs = M.useMediaQuery(t.breakpoints.down('xs'))
  const classes = useSortDropdownStyles()
  const [anchor, setAnchor] = React.useState(null)
  const open = React.useCallback(
    (evt) => {
      setAnchor(evt.target)
    },
    [setAnchor],
  )
  const close = React.useCallback(() => {
    setAnchor(null)
  }, [setAnchor])

  const handleClick = React.useCallback(
    (key) => {
      // TODO: use UIModel
      UIModel.storage.set('sortPackagesBy', key)
      close()
    },
    [close],
  )

  const selected = UIModel.getSort(value)

  return (
    <>
      {xs ? (
        <M.IconButton onClick={open}>
          <M.Icon>sort</M.Icon>
        </M.IconButton>
      ) : (
        <M.Button onClick={open} className={classes.root}>
          Sort by:
          <M.Box component="span" fontWeight="fontWeightMedium" ml={1}>
            {selected.label}
          </M.Box>
          <M.Icon>expand_more</M.Icon>
        </M.Button>
      )}
      <M.Menu anchorEl={anchor} open={!!anchor} onClose={close}>
        {options.map((o) => (
          <M.MenuItem
            onClick={() => handleClick(o.key)}
            component={RRDom.Link}
            to={makeSortUrl(o.key)}
            key={o.key}
            selected={o.key === value}
          >
            {o.label}
          </M.MenuItem>
        ))}
      </M.Menu>
    </>
  )
}

const useStyles = M.makeStyles((t) => ({
  paper: {
    [t.breakpoints.down('xs')]: {
      borderRadius: 0,
      boxShadow: 'none',
    },
  },
  searchIcon: {
    left: 8,
    pointerEvents: 'none',
    position: 'absolute',
  },
  input: {
    paddingLeft: t.spacing(5),
    paddingRight: t.spacing(5),
    paddingBottom: 11,
    paddingTop: 10,
    [t.breakpoints.down('xs')]: {
      paddingBottom: 15,
      paddingTop: 14,
    },
  },
  clear: {
    position: 'absolute',
    right: -4,
  },
}))

function PackageList() {
  const classes = useStyles()

  const scrollRef = React.useRef<HTMLDivElement | null>(null)

  const model = UIModel.use()

  // scroll to top on page change
  usePrevious(model.computed.page, (prev) => {
    if (prev && model.computed.page !== prev && scrollRef.current) {
      scrollRef.current.scrollIntoView()
    }
  })

  const { prefs } = BucketPreferences.use()

  return (
    <>
      {model.packageCreationDialog.dialog.render({
        successTitle: 'Package created',
        successRenderMessage: ({ packageLink }) => (
          <>Package {packageLink} successfully created</>
        ),
        title: 'Create package',
      })}

      {GQL.fold(model.totalCountQuery, {
        fetching: () => (
          <M.Box pb={{ xs: 0, sm: 5 }} mx={{ xs: -2, sm: 0 }}>
            <M.Box mt={{ xs: 0, sm: 3 }} display="flex" justifyContent="space-between">
              <M.Box
                component={M.Paper}
                className={classes.paper}
                flexGrow={{ xs: 1, sm: 0 }}
                px={2}
                py={{ xs: 1.75, sm: 1.25 }}
              >
                <Skeleton
                  height={20}
                  width={{ xs: '100%', sm: 160 }}
                  borderRadius="borderRadius"
                />
              </M.Box>
              <M.Box
                component={M.Paper}
                className={classes.paper}
                px={2}
                py={{ xs: 1.75, sm: 1.25 }}
              >
                <Skeleton
                  height={20}
                  width={{ xs: 24, sm: 120 }}
                  borderRadius="borderRadius"
                />
              </M.Box>
            </M.Box>
            {R.range(0, 10).map((i) => (
              <PackageSkel key={i} />
            ))}
          </M.Box>
        ),
        error: displayError(),
        data: (totalCountData) => {
          if (!totalCountData.packages?.total) {
            return (
              <M.Box pt={5} textAlign="center">
                <M.Typography variant="h4">No packages</M.Typography>
                <M.Box pt={3} />
                {BucketPreferences.Result.match(
                  {
                    Ok: ({ ui: { actions } }) =>
                      actions.createPackage && (
                        <>
                          <M.Button
                            variant="contained"
                            color="primary"
                            onClick={model.packageCreationDialog.open}
                          >
                            Create package
                          </M.Button>
                          <M.Box pt={2} />
                          <M.Typography>
                            Or{' '}
                            <StyledLink href={EXAMPLE_PACKAGE_URL} target="_blank">
                              push a package
                            </StyledLink>{' '}
                            with the Quilt Python API.
                          </M.Typography>
                        </>
                      ),
                    Pending: () => <Buttons.Skeleton />,
                    Init: () => null,
                  },
                  prefs,
                )}
              </M.Box>
            )
          }

          return (
            <M.Box pb={{ xs: 0, sm: 5 }} mx={{ xs: -2, sm: 0 }}>
              <M.Box position="relative" top={-80} ref={scrollRef} />
              <M.Box display="flex" mt={{ xs: 0, sm: 3 }}>
                <M.Box
                  component={M.Paper}
                  className={classes.paper}
                  flexGrow={{ xs: 1, sm: 0 }}
                  position="relative"
                >
                  <M.InputBase
                    {...model.filtering.input}
                    placeholder="Filter packages"
                    classes={{ input: classes.input }}
                    fullWidth
                    startAdornment={
                      <M.Icon className={classes.searchIcon}>search</M.Icon>
                    }
                    endAdornment={
                      <M.Fade in={!!model.filtering.input.value}>
                        <M.IconButton
                          className={classes.clear}
                          onClick={() => model.filtering.set('')}
                        >
                          <M.Icon>clear</M.Icon>
                        </M.IconButton>
                      </M.Fade>
                    }
                  />
                </M.Box>
                <M.Box flexGrow={1} display={{ xs: 'none', sm: 'block' }} />
                {BucketPreferences.Result.match(
                  {
                    Ok: ({ ui: { actions } }) =>
                      actions.createPackage && (
                        <M.Box display={{ xs: 'none', sm: 'block' }} pr={1}>
                          <M.Button
                            variant="contained"
                            size="large"
                            color="primary"
                            style={{ paddingTop: 7, paddingBottom: 7 }}
                            onClick={model.packageCreationDialog.open}
                          >
                            Create package
                          </M.Button>
                        </M.Box>
                      ),
                    Pending: () => (
                      <M.Box display={{ xs: 'none', sm: 'block' }} pr={1}>
                        <Buttons.Skeleton size="large" />
                      </M.Box>
                    ),
                    Init: () => null,
                  },
                  prefs,
                )}
                <M.Box component={M.Paper} className={classes.paper}>
                  <SortDropdown
                    value={model.computed.sort.key}
                    options={UIModel.SORT_OPTIONS}
                    makeSortUrl={model.makeSortUrl}
                  />
                </M.Box>
              </M.Box>

              {GQL.fold(model.filteredCountQuery, {
                fetching: () => R.range(0, 10).map((i) => <PackageSkel key={i} />),
                error: displayError(),
                data: (filteredCountData) => {
                  const filteredCount = filteredCountData.packages?.total
                  if (!filteredCount) {
                    return (
                      <M.Box
                        borderTop={{ xs: 1, sm: 0 }}
                        borderColor="divider"
                        pt={3}
                        px={{ xs: 2, sm: 0 }}
                      >
                        <M.Typography variant="h5">
                          No matching packages found
                        </M.Typography>
                      </M.Box>
                    )
                  }

                  const pages = Math.ceil(filteredCount / UIModel.PER_PAGE)

                  if (model.computed.page > pages) {
                    return <RRDom.Redirect to={model.makePageUrl(pages)} />
                  }

                  return (
                    <>
                      {GQL.fold(model.packagesQuery, {
                        fetching: () => {
                          const items =
                            model.computed.page < pages
                              ? UIModel.PER_PAGE
                              : filteredCount % UIModel.PER_PAGE
                          return R.range(0, items).map((i) => <PackageSkel key={i} />)
                        },
                        error: displayError(),
                        data: (packagesData) =>
                          (packagesData.packages?.page || []).map((pkg) => (
                            <Package key={pkg.name} {...pkg} />
                          )),
                      })}
                      {pages > 1 && (
                        <Pagination
                          {...{
                            pages,
                            page: model.computed.page,
                            makePageUrl: model.makePageUrl,
                          }}
                        />
                      )}
                    </>
                  )
                },
              })}
            </M.Box>
          )
        },
      })}
    </>
  )
}

// function PackageListLayout() {
//   return (
//     <>
//       filters
//       results
//     </>
//   )
// }

export default function PackageListWrapper() {
  const { bucket } = RRDom.useParams<{ bucket: string }>()
  invariant(!!bucket, '`bucket` must be defined')
  return (
    <>
      <MetaTitle>{['Packages', bucket]}</MetaTitle>
      <WithPackagesSupport bucket={bucket}>
        <UIModel.Provider>
          <PackageList />
        </UIModel.Provider>
      </WithPackagesSupport>
    </>
  )
}

/* TODO: optimize LinkedData fetching
{!!bucketCfg &&
  (packages && []).map(({ name }) => (
    <Data.Fetcher
      key={name}
      fetch={requests.getRevisionData}
      params={{ s3, sign, endpoint, bucket, name, id: 'latest', maxKeys: 0 }}
    >
      {AsyncResult.case({
        _: () => null,
        Ok: ({ hash, modified, header }) => (
          <React.Suspense fallback={null}>
            <LinkedData.PackageData
              {...{
                bucket: bucketCfg,
                name,
                revision: 'latest',
                hash,
                modified,
                header,
              }}
            />
          </React.Suspense>
        ),
      })}
    </Data.Fetcher>
  ))}
*/
