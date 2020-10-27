import * as R from 'ramda'
import * as React from 'react'
import * as redux from 'react-redux'
import * as M from '@material-ui/core'

import JsonDisplay from 'components/JsonDisplay'
// import Message from 'components/Message'
import * as Auth from 'containers/Auth'
import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import * as Config from 'utils/Config'
import pipeThru from 'utils/pipeThru'

// import Code from './Code'
import Section from './Section'

// TODO: move here everything that's reused btw Bucket/File, Bucket/PackageTree and Embed/File

export function Meta({ data, ...props }) {
  return pipeThru(data)(
    AsyncResult.case({
      Ok: (meta) =>
        !!meta &&
        !R.isEmpty(meta) && (
          <Section icon="list" heading="Metadata" defaultExpanded {...props}>
            <JsonDisplay value={meta} defaultExpanded={1} />
          </Section>
        ),
      _: () => null,
    }),
  )
}

const useDownloadButtonStyles = M.makeStyles(() => ({
  root: {
    flexShrink: 0,
    marginBottom: -3,
    marginTop: -3,
  },
}))

export function DownloadButtonLayout({ label, icon, ...props }) {
  const classes = useDownloadButtonStyles()
  const t = M.useTheme()
  const xs = M.useMediaQuery(t.breakpoints.down('xs'))

  return xs ? (
    <M.IconButton className={classes.root} edge="end" size="small" {...props}>
      <M.Icon>{icon}</M.Icon>
    </M.IconButton>
  ) : (
    <M.Button
      className={classes.root}
      variant="outlined"
      size="small"
      startIcon={<M.Icon>{icon}</M.Icon>}
      {...props}
    >
      {label}
    </M.Button>
  )
}

export function DownloadButton({ handle }) {
  return AWS.Signer.withDownloadUrl(handle, (url) => (
    <DownloadButtonLayout
      href={url}
      download
      label="Download file"
      icon="arrow_downward"
    />
  ))
}

export function ZipDownloadForm({ suffix, label }) {
  const { s3Proxy, noDownload } = Config.use()
  const { token } = redux.useSelector(Auth.selectors.tokens) || {}
  if (!token || noDownload) return null
  const action = `${s3Proxy}/zip/${suffix}`
  return (
    <form action={action} target="_blank" method="POST" style={{ flexShrink: 0 }}>
      <input type="hidden" name="token" value={token} />
      <DownloadButtonLayout label={label} icon="arrow_downward" type="submit" />
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
