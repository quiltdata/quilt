import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import JsonDisplay from 'components/JsonDisplay'
// import Message from 'components/Message'
import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
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
            <JsonDisplay value={meta} />
          </Section>
        ),
      _: () => null,
    }),
  )
}

const useDownloadButtonStyles = M.makeStyles(() => ({
  button: {
    flexShrink: 0,
    marginBottom: -3,
    marginTop: -3,
  },
}))

export function DownloadButton({ handle }) {
  const classes = useDownloadButtonStyles()
  const t = M.useTheme()
  const xs = M.useMediaQuery(t.breakpoints.down('xs'))

  return AWS.Signer.withDownloadUrl(handle, (url) =>
    xs ? (
      <M.IconButton
        className={classes.button}
        href={url}
        edge="end"
        size="small"
        download
      >
        <M.Icon>arrow_downward</M.Icon>
      </M.IconButton>
    ) : (
      <M.Button
        href={url}
        className={classes.button}
        variant="outlined"
        size="small"
        startIcon={<M.Icon>arrow_downward</M.Icon>}
        download
      >
        Download file
      </M.Button>
    ),
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
