import { basename } from 'path'

import * as dateFns from 'date-fns'
import dedent from 'dedent'
import PT from 'prop-types'
import * as R from 'ramda'
import * as React from 'react'
import { FormattedRelative } from 'react-intl'
import { Link } from 'react-router-dom'
import * as RC from 'recompose'
import {
  Button,
  CircularProgress,
  Icon,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemSecondaryAction,
  ListItemText,
  Popover,
  Typography,
  colors,
} from '@material-ui/core'
import { unstable_Box as Box } from '@material-ui/core/Box'
import { makeStyles, styled } from '@material-ui/styles'

import ButtonIcon from 'components/ButtonIcon'
import Sparkline from 'components/Sparkline'
import AsyncResult from 'utils/AsyncResult'
import * as AWS from 'utils/AWS'
import * as Config from 'utils/Config'
import Data from 'utils/Data'
import * as NamedRoutes from 'utils/NamedRoutes'
import { linkStyle } from 'utils/StyledLink'
import parseSearch from 'utils/parseSearch'
import * as RT from 'utils/reactTools'
import { getBreadCrumbs, up } from 'utils/s3paths'
import { readableBytes, readableQuantity } from 'utils/string'

import BreadCrumbs, { Crumb } from './BreadCrumbs'
import Code from './Code'
import FilePreview from './FilePreview'
import Section from './Section'
import * as requests from './requests'
import { withSignedUrl } from './utils'

const getCrumbs = ({ bucket, path, urls }) =>
  R.chain(
    ({ label, path: segPath }) => [
      Crumb.Segment({ label, to: urls.bucketDir(bucket, segPath) }),
      Crumb.Sep(<React.Fragment>&nbsp;/ </React.Fragment>),
    ],
    [{ label: bucket, path: '' }, ...getBreadCrumbs(up(path))],
  )

const useVersionInfoStyles = makeStyles(({ typography }) => ({
  version: {
    ...linkStyle,
    alignItems: 'center',
    display: 'flex',
  },
  mono: {
    fontFamily: typography.monospace.fontFamily,
  },
  list: {
    width: 420,
  },
}))

const VersionInfo = RT.composeComponent(
  'Bucket.File.VersionInfo',
  RC.setPropTypes({
    bucket: PT.string.isRequired,
    path: PT.string.isRequired,
    version: PT.string,
  }),
  ({ bucket, path, version }) => {
    const s3 = AWS.S3.use()
    const { urls } = NamedRoutes.use()

    const [anchor, setAnchor] = React.useState()
    const [opened, setOpened] = React.useState(false)
    const open = React.useCallback(() => setOpened(true), [])
    const close = React.useCallback(() => setOpened(false), [])

    const classes = useVersionInfoStyles()

    return (
      <React.Fragment>
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
        <span className={classes.version} onClick={open} ref={setAnchor}>
          {version ? (
            <span className={classes.mono}>{version.substring(0, 12)}</span>
          ) : (
            'latest'
          )}{' '}
          <Icon>expand_more</Icon>
        </span>
        <Data fetch={requests.objectVersions} params={{ s3, bucket, path }}>
          {R.pipe(
            AsyncResult.case({
              Ok: (versions) => (
                <List className={classes.list}>
                  {versions.map((v) => (
                    <ListItem
                      key={v.id}
                      button
                      onClick={close}
                      selected={version ? v.id === version : v.isLatest}
                      component={Link}
                      to={urls.bucketFile(bucket, path, v.id)}
                    >
                      <ListItemText
                        primary={
                          <span>
                            <FormattedRelative value={v.lastModified} />
                            {' | '}
                            {readableBytes(v.size)}
                            {v.isLatest && ' | latest'}
                          </span>
                        }
                        secondary={
                          <span>
                            {v.lastModified.toLocaleString()}
                            <br />
                            <span className={classes.mono}>{v.id}</span>
                          </span>
                        }
                      />
                      <ListItemSecondaryAction>
                        {withSignedUrl({ bucket, key: path, version: v.id }, (url) => (
                          <IconButton href={url}>
                            <Icon>arrow_downward</Icon>
                          </IconButton>
                        ))}
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              ),
              Err: () => (
                <List>
                  <ListItem>
                    <ListItemIcon>
                      <Icon>error</Icon>
                    </ListItemIcon>
                    <Typography variant="body1">Error fetching versions</Typography>
                  </ListItem>
                </List>
              ),
              _: () => (
                <List>
                  <ListItem>
                    <ListItemIcon>
                      <CircularProgress size={24} />
                    </ListItemIcon>
                    <Typography variant="body1">Fetching versions</Typography>
                  </ListItem>
                </List>
              ),
            }),
            (children) => (
              <Popover
                open={opened && !!anchor}
                anchorEl={anchor}
                onClose={close}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                transformOrigin={{ vertical: 'top', horizontal: 'center' }}
              >
                {children}
              </Popover>
            ),
          )}
        </Data>
      </React.Fragment>
    )
  },
)

const AnnotationsBox = styled('div')(({ theme: t }) => ({
  background: colors.lightBlue[50],
  border: [[1, 'solid', colors.lightBlue[400]]],
  borderRadius: t.shape.borderRadius,
  fontFamily: t.typography.monospace.fontFamily,
  fontSize: t.typography.body2.fontSize,
  overflow: 'auto',
  padding: t.spacing.unit,
  whiteSpace: 'pre',
  width: '100%',
}))

const Annotations = ({ bucket, path, version }) => {
  const s3 = AWS.S3.use()
  return (
    <Data fetch={requests.objectMeta} params={{ s3, bucket, path, version }}>
      {AsyncResult.case({
        Ok: (meta) =>
          !!meta &&
          !R.isEmpty(meta) && (
            <Section icon="list" heading="Annotations">
              <AnnotationsBox>{JSON.stringify(meta, null, 2)}</AnnotationsBox>
            </Section>
          ),
        _: () => null,
      })}
    </Data>
  )
}

const useStyles = makeStyles(({ spacing: { unit }, palette }) => ({
  topBar: {
    alignItems: 'center',
    display: 'flex',
    marginBottom: 2 * unit,
  },
  nameAndVersion: {
    display: 'flex',
  },
  basename: {
    maxWidth: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  at: {
    color: palette.text.secondary,
    marginLeft: unit,
    marginRight: unit,
  },
  spacer: {
    flexGrow: 1,
  },
  button: {
    marginLeft: unit,
  },
}))

const Analytics = ({ bucket, path }) => {
  const [cursor, setCursor] = React.useState(null)
  const { analyticsBucket } = Config.useConfig()
  const s3 = AWS.S3.use()
  const today = React.useMemo(() => new Date(), [])
  const formatDate = (date) =>
    dateFns.format(
      date,
      today.getFullYear() === date.getFullYear() ? `D MMM` : `D MMM YYYY`,
    )
  return (
    <Section icon="bar_charts" heading="Analytics" defaultExpanded>
      <Data
        fetch={requests.objectAccessCounts}
        params={{ s3, analyticsBucket, bucket, path, today }}
      >
        {AsyncResult.case({
          Ok: ({ counts, total }) => (
            <Box
              display="flex"
              width="100%"
              justifyContent="space-between"
              alignItems="center"
            >
              <Box>
                <Typography variant="h5">Downloads</Typography>
                <Typography variant="h4" component="div">
                  {readableQuantity(cursor === null ? total : counts[cursor].value)}
                </Typography>
                <Typography variant="overline" component="span">
                  {cursor === null
                    ? `${counts.length} days`
                    : formatDate(counts[cursor].date)}
                </Typography>
              </Box>
              <Box width="calc(100% - 7rem)">
                <Sparkline
                  data={R.pluck('value', counts)}
                  onCursor={setCursor}
                  width={1000}
                  height={60}
                  color={colors.blueGrey[100]}
                  color2={colors.blueGrey[800]}
                  fill={false}
                />
              </Box>
            </Box>
          ),
          Err: () => <Typography>Couldn&apos;t fetch the data</Typography>,
          _: () => <CircularProgress />,
        })}
      </Data>
    </Section>
  )
}

export default ({
  match: {
    params: { bucket, path },
  },
  location,
}) => {
  const { version } = parseSearch(location.search)
  const classes = useStyles()
  const { urls } = NamedRoutes.use()

  const code = dedent`
    import t4
    b = t4.Bucket("s3://${bucket}")
    b.fetch("${path}", "./${basename(path)}")
  `

  return (
    <React.Fragment>
      <BreadCrumbs variant="subtitle1" items={getCrumbs({ bucket, path, urls })} />
      <div className={classes.topBar}>
        <Typography variant="h6" className={classes.nameAndVersion}>
          <span className={classes.basename} title={basename(path)}>
            {basename(path)}
          </span>
          <span className={classes.at}> @ </span>
          <VersionInfo bucket={bucket} path={path} version={version} />
        </Typography>
        <div className={classes.spacer} />
        {withSignedUrl({ bucket, key: path, version }, (url) => (
          <Button variant="outlined" href={url} className={classes.button}>
            <ButtonIcon position="left">arrow_downward</ButtonIcon> Download
          </Button>
        ))}
      </div>
      <Section icon="code" heading="Code">
        <Code>{code}</Code>
      </Section>
      <Analytics {...{ bucket, path }} />
      <Section icon="remove_red_eye" heading="Contents" defaultExpanded>
        <FilePreview handle={{ bucket, key: path, version }} />
      </Section>
      <Annotations bucket={bucket} path={path} version={version} />
    </React.Fragment>
  )
}
