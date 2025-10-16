import cx from 'classnames'
import * as React from 'react'
import * as redux from 'react-redux'
import * as M from '@material-ui/core'

// import Message from 'components/Message'
import * as Buttons from 'components/Buttons'
import SelectDropdown from 'components/SelectDropdown'
import cfg from 'constants/config'
import { tokens as tokensSelector } from 'containers/Auth/selectors'
import * as AWS from 'utils/AWS'

export * from './Meta'

// TODO: move here everything that's reused btw Bucket/File and Bucket/PackageTree

export function DownloadButton({ className, handle }) {
  return AWS.Signer.withDownloadUrl(handle, (url) => (
    <Buttons.Iconized
      className={className}
      href={url}
      download
      label="Download file"
      icon="arrow_downward"
    />
  ))
}

const useViewModeSelectorStyles = M.makeStyles((t) => ({
  root: {
    flexShrink: 0,
    marginBottom: -3,
    marginTop: -3,
  },
  label: {
    marginRight: t.spacing(1),
  },
}))

export function ViewModeSelector({ className, ...props }) {
  const classes = useViewModeSelectorStyles()
  const t = M.useTheme()
  const sm = M.useMediaQuery(t.breakpoints.down('sm'))
  return (
    <SelectDropdown className={cx(classes.root, className)} shrink={sm} {...props}>
      {sm ? <M.Icon>visibility</M.Icon> : <span className={classes.label}>View as:</span>}
    </SelectDropdown>
  )
}

/** Child button must have `type="submit"` */
export function ZipDownloadForm({
  className = '',
  suffix,
  children,
  newTab = false,
  files = [],
}) {
  const { token } = redux.useSelector(tokensSelector) || {}
  if (!token || cfg.noDownload) return null
  const action = `${cfg.s3Proxy}/zip/${suffix}`
  return (
    <form
      className={className}
      action={action}
      target={newTab ? '_blank' : undefined}
      method="POST"
      style={{ flexShrink: 0 }}
    >
      <input type="hidden" name="token" value={token} />
      {files.map((file) => (
        <input type="hidden" name="file" value={file} key={file} />
      ))}
      {children}
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
