import * as React from 'react'
import * as M from '@material-ui/core'

import { Tabs } from 'components/Dialog'

const useStyles = M.makeStyles((t) => ({
  download: {
    width: t.spacing(40),
  },
  code: {
    width: t.spacing(80),
  },
}))

interface GetOptionsProps {
  download: NonNullable<React.ReactNode>
  code?: NonNullable<React.ReactNode>
}

export default function GetOptions({ download, code }: GetOptionsProps) {
  const classes = useStyles()

  const downloadTab = React.useMemo(
    () => ({
      className: classes.download,
      label: 'Download',
      panel: download,
    }),
    [classes.download, download],
  )

  const codeTab = React.useMemo(
    () =>
      code
        ? {
            className: classes.code,
            label: 'Code',
            panel: code,
          }
        : null,
    [classes.code, code],
  )

  const tabs = React.useMemo(
    () => [downloadTab, ...(codeTab ? [codeTab] : [])],
    [codeTab, downloadTab],
  )

  return <Tabs tabs={tabs} />
}
