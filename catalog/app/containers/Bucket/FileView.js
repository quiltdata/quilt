import cx from 'classnames'
import * as React from 'react'
import * as redux from 'react-redux'
import * as M from '@material-ui/core'

// import Message from 'components/Message'
import SelectDropdown from 'components/SelectDropdown'
import cfg from 'constants/config'
import { tokens as tokensSelector } from 'containers/Auth/selectors'
import * as AWS from 'utils/AWS'

export * from './Meta'

// TODO: move here everything that's reused btw Bucket/File, Bucket/PackageTree and Embed/File

const useAdaptiveButtonStyles = M.makeStyles((t) => ({
  root: {
    flexShrink: 0,
    marginBottom: -3,
    marginTop: -3,
  },
  label: {
    marginRight: t.spacing(1),
  },
}))

export function AdaptiveButtonLayout({ className, label, icon, ...props }) {
  const classes = useAdaptiveButtonStyles()
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
    <AdaptiveButtonLayout
      className={className}
      href={url}
      download
      label="Download file"
      icon="arrow_downward"
    />
  ))
}

export function ViewModeSelector({ className, ...props }) {
  const classes = useAdaptiveButtonStyles()
  const t = M.useTheme()
  const sm = M.useMediaQuery(t.breakpoints.down('sm'))
  return (
    <SelectDropdown className={cx(classes.root, className)} {...props}>
      {sm ? <M.Icon>visibility</M.Icon> : <span className={classes.label}>View as:</span>}
    </SelectDropdown>
  )
}

export function ZipDownloadForm({ className, suffix, label, newTab = false }) {
  const { token } = redux.useSelector(tokensSelector) || {}
  if (!token || cfg.noDownload) return null
  const action = `${cfg.s3Proxy}/zip/${suffix}`
  return (
    <form
      action={action}
      target={newTab ? '_blank' : undefined}
      method="POST"
      style={{ flexShrink: 0 }}
    >
      <input type="hidden" name="token" value={token} />
      <AdaptiveButtonLayout
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
