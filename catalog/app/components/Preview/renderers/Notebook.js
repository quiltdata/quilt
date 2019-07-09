import cx from 'classnames'
import renderMathInEl from 'katex/contrib/auto-render/auto-render'
import PT from 'prop-types'
import * as React from 'react'
import * as RC from 'recompose'
import { makeStyles } from '@material-ui/styles'

import 'katex/dist/katex.css'

import * as RT from 'utils/reactTools'

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

const useStyles = makeStyles({
  root: {
    width: '100%',
    // workaround to speed-up browser rendering / compositing
    '& div.input_area > div.highlight > pre': {
      overflow: 'hidden',
      whiteSpace: 'pre-wrap',
    },
  },
})

const Notebook = RT.composeComponent(
  'Preview.renderers.Notebook',
  RC.setPropTypes({
    children: PT.string,
    className: PT.string,
  }),
  ({ children, className, ...props } = {}) => {
    const classes = useStyles()
    return (
      <div
        className={cx(classes.root, className, 'ipynb-preview')}
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: children }}
        ref={renderMath}
        {...props}
      />
    )
  },
)

export default ({ preview }, props) => <Notebook {...props}>{preview}</Notebook>
