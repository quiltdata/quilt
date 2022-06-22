import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import JsonDisplay from 'components/JsonDisplay'
import AsyncResult from 'utils/AsyncResult'

import Section, { SectionProps } from './Section'

const useHeadCellStyles = M.makeStyles((t) => ({
  root: {
    borderRight: `1px solid ${t.palette.divider}`,
    width: t.spacing(20),
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
  lastRowCells: {
    borderBottom: 0,
  },
})

interface MetaData {
  message: string
  user_meta: object
  workflow: $TSFixMe
}

interface MetaProps extends Partial<SectionProps> {
  meta?: MetaData
}

function Meta({ meta, ...props }: MetaProps) {
  const classes = useMetaStyles()
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
              {/* @ts-expect-error */}
              <JsonDisplay value={value.user_meta} />
            </M.TableCell>
          </M.TableRow>
          <M.TableRow>
            <HeadCell className={classes.lastRowCells} title="/workflow">
              Workflow:
            </HeadCell>
            <M.TableCell className={classes.lastRowCells}>
              {/* @ts-expect-error */}
              <JsonDisplay value={value.workflow} />
            </M.TableCell>
          </M.TableRow>
        </M.TableBody>
      </M.Table>
    </Section>
  )
}

interface MetaWrapperProps extends Partial<SectionProps> {
  data: $TSFixMe
}

export default function MetaWrapper({ data, ...props }: MetaWrapperProps) {
  return AsyncResult.case(
    {
      Ok: (meta: MetaData) => <Meta meta={meta} {...props} />,
      _: () => null,
    },
    data,
  )
}
