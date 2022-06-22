import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import * as redux from 'react-redux'
import * as M from '@material-ui/core'

import JsonDisplay from 'components/JsonDisplay'
// import Message from 'components/Message'
import SelectDropdown from 'components/SelectDropdown'
import * as Auth from 'containers/Auth'
import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import * as Config from 'utils/Config'

import Section from './Section'

// TODO: move here everything that's reused btw Bucket/File, Bucket/PackageTree and Embed/File

const useMetaInnerStyles = M.makeStyles((t) => ({
  lastRowCells: {
    borderBottom: 0,
  },
  headCell: {
    width: t.spacing(20),
    borderRight: '1px solid rgba(224,224,224,1)',
  },
}))

const HeadCell = ({ className, children, title }) => {
  const classes = useMetaInnerStyles()
  return (
    <M.TableCell className={cx(classes.headCell, className)} component="th" scope="row">
      <M.Tooltip title={title}>
        <span>{children}</span>
      </M.Tooltip>
    </M.TableCell>
  )
}

function MetaInner({ meta, ...props }) {
  const classes = useMetaInnerStyles()
  const value = React.useMemo(() => (meta && !R.isEmpty(meta) ? meta : null), [meta])

  if (!value) return null

  return (
    <Section icon="list" heading="Metadata" defaultExpanded {...props}>
      <M.Table size="small">
        <M.TableBody>
          <M.TableRow>
            <HeadCell title="/message">Commit message:</HeadCell>
            <M.TableCell>
              <M.Typography>"{value.message}"</M.Typography>
            </M.TableCell>
          </M.TableRow>
          <M.TableRow>
            <HeadCell title="/user_metadata">User metadata:</HeadCell>
            <M.TableCell>
              <JsonDisplay value={value.user_meta} />
            </M.TableCell>
          </M.TableRow>
          <M.TableRow>
            <HeadCell className={classes.lastCell} title="/workflow">
              Workflow:
            </HeadCell>
            <M.TableCell className={classes.lastCell}>
              <JsonDisplay value={value.workflow} />
            </M.TableCell>
          </M.TableRow>
        </M.TableBody>
      </M.Table>
    </Section>
  )
}

export function Meta({ data, ...props }) {
  return AsyncResult.case(
    {
      Ok: (meta) => <MetaInner meta={meta} {...props} />,
      _: () => null,
    },
    data,
  )
}

const useDownloadButtonStyles = M.makeStyles((t) => ({
  root: {
    flexShrink: 0,
    marginBottom: -3,
    marginTop: -3,
  },
  label: {
    marginRight: t.spacing(1),
  },
}))

export function DownloadButtonLayout({ className, label, icon, ...props }) {
  const classes = useDownloadButtonStyles()
  const t = M.useTheme()
  const sm = M.useMediaQuery(t.breakpoints.down('sm'))

  return sm ? (
    <M.IconButton
      className={cx(classes.root, className)}
      edge="end"
      size="small"
      {...props}
    >
      <M.Icon>{icon}</M.Icon>
    </M.IconButton>
  ) : (
    <M.Button
      className={cx(classes.root, className)}
      variant="outlined"
      size="small"
      startIcon={<M.Icon>{icon}</M.Icon>}
      {...props}
    >
      {label}
    </M.Button>
  )
}

export function DownloadButton({ className, handle }) {
  return AWS.Signer.withDownloadUrl(handle, (url) => (
    <DownloadButtonLayout
      className={className}
      href={url}
      download
      label="Download file"
      icon="arrow_downward"
    />
  ))
}

export function ViewModeSelector({ className, ...props }) {
  const classes = useDownloadButtonStyles()
  const t = M.useTheme()
  const sm = M.useMediaQuery(t.breakpoints.down('sm'))
  return (
    <SelectDropdown className={cx(classes.root, className)} {...props}>
      {sm ? <M.Icon>visibility</M.Icon> : <span className={classes.label}>View as:</span>}
    </SelectDropdown>
  )
}

export function ZipDownloadForm({ className, suffix, label, newTab = false }) {
  const { s3Proxy, noDownload } = Config.use()
  const { token } = redux.useSelector(Auth.selectors.tokens) || {}
  if (!token || noDownload) return null
  const action = `${s3Proxy}/zip/${suffix}`
  return (
    <form
      action={action}
      target={newTab ? '_blank' : undefined}
      method="POST"
      style={{ flexShrink: 0 }}
    >
      <input type="hidden" name="token" value={token} />
      <DownloadButtonLayout
        className={className}
        label={label}
        icon="archive"
        type="submit"
      />
    </form>
  )
}

export function Root(props) {
  return <M.Box pt={2} pb={4} {...props} />
}

/*
export function Header() {
}

export function TopBar() {
}

export function GlobalProgress() {
}

export function GlobalError(props) {
  return <Message {...props} />
}

const renderDownload = (handle) => !!handle && <DownloadButton {...{ handle }} />

function FileView({
  header,
  subheader, 
}) {
  return (
    <Root>
      <Header>{header}</Header>
      <TopBar>
        {subheader}
        'spacer'
        {withDownloadData(renderDownload)}
      </TopBar>
      {withFileData(AsyncResult.case({
        //_: () => <GlobalProgress />,
        _: renderFileProgress,
        // TODO: use proper err msgs
        //Err: (e) => <GlobalError />,
        Err: renderFileErr,
        Ok: () => (
          <>
            {withCodeData(renderCode)}
            {withAnalyticsData(renderAnalytics)}
            {withPreviewData(renderPreview)}
            {withMetaData(renderMeta)}
          </>
        ),
      }))}
    </Root>
  )
}
*/
