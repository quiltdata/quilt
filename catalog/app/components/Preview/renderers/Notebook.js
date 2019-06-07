import cx from 'classnames'
import PT from 'prop-types'
import * as React from 'react'
import * as RC from 'recompose'
import { Box } from '@material-ui/core'

import 'katex/dist/katex.css'

import * as RT from 'utils/reactTools'

const Notebook = RT.composeComponent(
  'Preview.renderers.Notebook',
  RC.setPropTypes({
    children: PT.string,
    className: PT.string,
  }),
  ({ children, className, ...props } = {}) => (
    <Box
      width="100%"
      className={cx(className, 'ipynb-preview')}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: children }}
      {...props}
    />
  ),
)

export default ({ preview }, props) => <Notebook {...props}>{preview}</Notebook>
