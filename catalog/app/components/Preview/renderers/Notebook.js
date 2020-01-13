import cx from 'classnames'
import renderMathInEl from 'katex/contrib/auto-render/auto-render'
import * as React from 'react'
import * as M from '@material-ui/core'

import 'katex/dist/katex.css'

import { renderPreviewStatus } from './util'

const MATH_DELIMITERS = [
  { left: '$$', right: '$$', display: true },
  { left: '$', right: '$', display: false },
  { left: '\\(', right: '\\)', display: false },
  { left: '\\[', right: '\\]', display: true },
]

const renderMath = (el) => {
  if (!el) return
  renderMathInEl(el, { delimiters: MATH_DELIMITERS })
}

const useStyles = M.makeStyles({
  root: {
    width: '100%',
  },
  contents: {
    // workaround to speed-up browser rendering / compositing
    '& pre': {
      overflow: 'hidden',
      whiteSpace: 'pre-wrap',
    },
  },
})

function Notebook({ children, className, note, warnings, ...props } = {}) {
  const classes = useStyles()
  return (
    <div className={cx(classes.root, className)} {...props}>
      {renderPreviewStatus({ note, warnings })}
      <div
        className={cx(classes.contents, 'ipynb-preview')}
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: children }}
        ref={renderMath}
      />
    </div>
  )
}

export default ({ preview, note, warnings }, props) => (
  <Notebook {...{ note, warnings }} {...props}>
    {preview}
  </Notebook>
)
