import * as React from 'react'
import * as M from '@material-ui/core'

import { createBoundary } from 'utils/ErrorBoundary'
import Placeholder from 'components/Placeholder'
import * as RT from 'utils/reactTools'

import type { NglFile } from './Ngl'

function NglError() {
  // TODO: <a href={docs}>Learn more</a>
  return <M.Typography>Oops. Unable to parse file.</M.Typography>
}

const ErrorBoundary = createBoundary(() => () => <NglError />)

const SuspensePlaceholder = () => <Placeholder color="text.secondary" />

const Ngl = RT.mkLazy(() => import('./Ngl'), SuspensePlaceholder)

const useStyles = M.makeStyles({
  root: {
    flexDirection: 'column',
    width: '100%',
  },
})

function Wrapper({ children }: React.PropsWithChildren<{}>) {
  const classes = useStyles()
  return <div className={classes.root}>{children}</div>
}

export default function NglWrapper(
  data: { files: NglFile[] },
  props: React.HTMLAttributes<HTMLDivElement>,
) {
  return (
    <ErrorBoundary>
      <Wrapper>
        {data.files.map((file, index) => (
          <Ngl key={`nlg_${index}`} {...file} {...props} />
        ))}
      </Wrapper>
    </ErrorBoundary>
  )
}
