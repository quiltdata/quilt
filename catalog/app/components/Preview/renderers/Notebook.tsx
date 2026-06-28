import cx from 'classnames'
import renderMathInEl from 'katex/contrib/auto-render/auto-render'
import * as React from 'react'
import * as M from '@material-ui/core'

import 'katex/dist/katex.css'

import 'assets/ipynb.css'

import { renderWarnings } from './util'

const MATH_DELIMITERS = [
  { left: '$$', right: '$$', display: true },
  { left: '$', right: '$', display: false },
  { left: '\\(', right: '\\)', display: false },
  { left: '\\[', right: '\\]', display: true },
]

const renderMath = (el: HTMLElement | null) => {
  if (!el) return
  renderMathInEl(el, { delimiters: MATH_DELIMITERS })
}

const useStyles = M.makeStyles({
  contents: {
    // workaround to speed-up browser rendering / compositing
    '& pre': {
      overflow: 'hidden',
      whiteSpace: 'pre-wrap',
    },
  },
})

interface NotebookProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: string
  className?: string
  note?: string
  warnings?: string
}

function Notebook({ children, className, note, warnings, ...props }: NotebookProps = {}) {
  const classes = useStyles()
  return (
    <div className={className} {...props}>
      {renderWarnings(warnings)}
      <div
        title={note}
        className={cx(classes.contents, 'ipynb-preview')}
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: children as string }}
        ref={renderMath}
      />
    </div>
  )
}

export default (
  { preview, note, warnings }: { preview: string; note?: string; warnings?: string },
  props?: NotebookProps,
) => (
  <Notebook {...{ note, warnings }} {...props}>
    {preview}
  </Notebook>
)
