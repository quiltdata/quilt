import * as React from 'react'
import * as M from '@material-ui/core'

import { createBoundary } from 'utils/ErrorBoundary'
import Placeholder from 'components/Placeholder'
import * as RT from 'utils/reactTools'

import type { NglFile, NglProps } from './Ngl'

function NglError() {
  // TODO: <a href={docs}>Learn more</a>
  return <M.Typography>Oops. Unable to parse file.</M.Typography>
}

const ErrorBoundary = createBoundary(() => () => <NglError />)

const SuspensePlaceholder = () => <Placeholder color="text.secondary" />

const Ngl: React.FC<NglProps> = RT.mkLazy(() => import('./Ngl'), SuspensePlaceholder)

const useStyles = M.makeStyles((t) => ({
  root: {
    flexDirection: 'column',
    width: '100%',
  },
  item: {
    '& + &': {
      borderTop: `1px solid ${t.palette.divider}`,
      marginTop: t.spacing(2),
      paddingTop: t.spacing(2),
    },
  },
}))

interface NglWrapperProps extends React.HTMLAttributes<HTMLDivElement> {
  files: NglFile[]
}

function NglRenderer({ files, className, ...props }: NglWrapperProps) {
  const classes = useStyles()
  return (
    <div className={classes.root} {...props}>
      {files.map((file, index) => (
        <Ngl {...file} className={classes.item} key={`nlg_${index}`} />
      ))}
    </div>
  )
}

export default function NglWrapper(
  data: { files: NglFile[] },
  props: React.HTMLAttributes<HTMLDivElement>,
) {
  return (
    <ErrorBoundary>
      <NglRenderer files={data.files} {...props} />
    </ErrorBoundary>
  )
}
