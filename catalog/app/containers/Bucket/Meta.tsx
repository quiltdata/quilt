import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import JsonDisplay from 'components/JsonDisplay'
import AsyncResult from 'utils/AsyncResult'

import Section, { SectionProps } from './Section'

const useHeadCellStyles = M.makeStyles((t) => ({
  root: {
    paddingTop: t.spacing(1),
    verticalAlign: 'top',
    width: t.spacing(17.5),
  },
}))

interface HeadCellProps {
  children: React.ReactNode
  className?: string
  title: string
}

const HeadCell = ({ className, children, title }: HeadCellProps) => {
  const classes = useHeadCellStyles()
  return (
    <M.TableCell className={cx(classes.root, className)} component="th" scope="row">
      <M.Tooltip title={title}>
        <span>{children}</span>
      </M.Tooltip>
    </M.TableCell>
  )
}

const useMetaStyles = M.makeStyles({
  message: {
    paddingLeft: '4px',
  },
  lastRowCells: {
    borderBottom: 0,
  },
})

interface MetaData {
  message: string
  user_meta?: object
  version: 'v0'
  workflow?: $TSFixMe
}

interface MetaProps extends Partial<SectionProps> {
  meta: MetaData
}

function Meta({ meta, ...props }: MetaProps) {
  const classes = useMetaStyles()

  const { message, user_meta: userMeta, workflow, version, ...rest } = meta
  const objectMeta = React.useMemo(() => (!R.isEmpty(rest) ? rest : null), [rest])

  return (
    <Section icon="list" heading="Metadata" defaultExpanded {...props}>
      <div>
        <M.Table size="small">
          <M.TableBody>
            {message && (
              <M.TableRow>
                <HeadCell title="/message">Message:</HeadCell>
                <M.TableCell>
                  <M.Typography className={classes.message}>{message}</M.Typography>
                </M.TableCell>
              </M.TableRow>
            )}
            {userMeta && (
              <M.TableRow>
                <HeadCell title="/user_metadata">User metadata:</HeadCell>
                <M.TableCell>
                  {/* @ts-expect-error */}
                  <JsonDisplay value={userMeta} />
                </M.TableCell>
              </M.TableRow>
            )}
            {workflow && (
              <M.TableRow>
                <HeadCell className={classes.lastRowCells} title="/workflow">
                  Workflow:
                </HeadCell>
                <M.TableCell className={classes.lastRowCells}>
                  {/* @ts-expect-error */}
                  <JsonDisplay value={workflow} />
                </M.TableCell>
              </M.TableRow>
            )}
          </M.TableBody>
        </M.Table>

        {objectMeta && (
          /* @ts-expect-error */
          <JsonDisplay value={objectMeta} defaultExpanded={1} />
        )}
      </div>
    </Section>
  )
}

interface MetaWrapperProps extends Partial<SectionProps> {
  data: $TSFixMe
}

export default function MetaWrapper({ data, ...props }: MetaWrapperProps) {
  return AsyncResult.case(
    {
      Ok: (meta: MetaData) =>
        meta && !R.isEmpty(meta) ? <Meta meta={meta} {...props} /> : null,
      _: () => null,
    },
    data,
  )
}
