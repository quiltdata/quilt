import cx from 'classnames'
import PT from 'prop-types'
import * as React from 'react'
import * as RC from 'recompose'
import { withStyles } from '@material-ui/styles'

import * as RT from 'utils/reactTools'

const DataFrame = RT.composeComponent(
  'Preview.renderers.DataFrame',
  RC.setPropTypes({
    children: PT.string,
    className: PT.string,
  }),
  withStyles(({ palette, spacing: { unit } }) => ({
    root: {
      width: '100%',
    },
    wrapper: {
      overflow: 'auto',

      '& table.dataframe': {
        border: 'none',
        width: 'auto',

        '& tr:nth-child(even)': {
          backgroundColor: palette.grey[100],
        },

        '& th, & td': {
          border: 'none',
          fontSize: 'small',
          height: 3 * unit,
          paddingLeft: unit,
          paddingRight: unit,
        },

        '& td': {
          whiteSpace: 'nowrap',
        },
      },
    },
  })),
  ({ classes, children, className, ...props } = {}) => (
    <div className={cx(className, classes.root)} {...props}>
      <div
        className={classes.wrapper}
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: children }}
      />
    </div>
  ),
)

export default ({ preview }, props) => <DataFrame {...props}>{preview}</DataFrame>
