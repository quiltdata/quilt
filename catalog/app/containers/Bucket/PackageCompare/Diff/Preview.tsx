import * as React from 'react'
import * as M from '@material-ui/core'

import { Load, Display, CONTEXT } from 'components/Preview'
import Skeleton from 'components/Skeleton'
import * as Model from 'model'

interface PreviewProps {
  handle: Model.S3.S3ObjectLocation
}

const usePreviewStyles = M.makeStyles((t) => ({
  container: {
    minHeight: 200,
    padding: t.spacing(2),
  },
  progress: {
    padding: t.spacing(2),
  },
  message: {
    padding: t.spacing(2),
    textAlign: 'center',
  },
  heading: {
    ...t.typography.body1,
    marginBottom: t.spacing(1),
  },
  body: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
  },
}))

function PreviewProgress() {
  const classes = usePreviewStyles()
  return (
    <div className={classes.progress}>
      <Skeleton height={150} width="100%" />
    </div>
  )
}

interface PreviewMessageProps {
  heading: React.ReactNode
  body: React.ReactNode
  action?: React.ReactNode
}

function PreviewMessage({ heading, body, action }: PreviewMessageProps) {
  const classes = usePreviewStyles()
  return (
    <div className={classes.message}>
      {!!heading && <div className={classes.heading}>{heading}</div>}
      {!!body && <div className={classes.body}>{body}</div>}
      {action}
    </div>
  )
}

function PreviewContents({ children }: { children: React.ReactNode }) {
  const classes = usePreviewStyles()
  return <div className={classes.container}>{children}</div>
}

const renderPreviewAction = ({ label, ...rest }: { label: React.ReactNode }) => (
  <M.Button variant="outlined" size="small" {...rest}>
    {label}
  </M.Button>
)

export default function Preview({ handle }: PreviewProps) {
  return (
    <Load handle={handle} options={{ context: CONTEXT.LISTING }}>
      {(data: any) => (
        <Display
          data={data}
          noDownload={undefined}
          renderContents={(children: any) =>
            (<PreviewContents children={children} />) as $TSFixMe
          }
          renderProgress={() => <PreviewProgress />}
          renderMessage={(message: PreviewMessageProps) => (
            <PreviewMessage {...message} />
          )}
          renderAction={renderPreviewAction}
          onData={undefined}
          props={undefined}
        />
      )}
    </Load>
  )
}
