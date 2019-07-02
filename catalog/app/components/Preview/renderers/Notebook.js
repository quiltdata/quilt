import cx from 'classnames'
import PT from 'prop-types'
import * as React from 'react'
import * as RC from 'recompose'
import { makeStyles } from '@material-ui/styles'
import { unstable_Box as Box } from '@material-ui/core/Box'

import 'katex/dist/katex.css'

import * as RT from 'utils/reactTools'

const useStyles = makeStyles({
  root: {
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
      <Box
        width="100%"
        className={cx(classes.root, className, 'ipynb-preview')}
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: children }}
        {...props}
      />
    )
  },
)

export default ({ preview }, props) => <Notebook {...props}>{preview}</Notebook>
