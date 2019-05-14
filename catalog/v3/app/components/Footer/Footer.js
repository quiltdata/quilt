import * as React from 'react'
import { FormattedMessage } from 'react-intl'
import { withStyles } from '@material-ui/styles'

import FAIcon from 'components/FAIcon'
import { blog, twitter, gitWeb } from 'constants/urls'
import * as RT from 'utils/reactTools'

import messages from './messages'

export default RT.composeComponent(
  'Footer',
  withStyles(({ palette, breakpoints, spacing: { unit } }) => ({
    root: {
      backgroundColor: palette.primary.dark,
      color: palette.getContrastText(palette.primary.dark),
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      paddingBottom: 2 * unit,
      paddingTop: 2 * unit,
    },
    col: {
      width: '25%',
      textAlign: 'center',
      [breakpoints.down('xs')]: {
        width: '100%',
        '& + &': {
          marginTop: 2 * unit,
        },
      },
    },
    small: {
      fontSize: '.8em',
      lineHeight: '2em',
      opacity: 0.7,
    },
    link: {
      fontSize: '2em',
      lineHeight: '2em',
      '&, &:active, &:visited': {
        color: 'inherit',
        opacity: 0.9,
      },
      '&:hover, &:focus': {
        color: 'inherit',
        opacity: 1,
      },
    },
  })),
  ({ classes }) => (
    <footer className={classes.root}>
      <div className={classes.col}>
        <a className={classes.link} href={twitter}>
          <FAIcon type="twitter" />
        </a>
      </div>
      <div className={classes.col}>
        <a className={classes.link} href={gitWeb}>
          <FAIcon type="github" />
        </a>
      </div>
      <div className={classes.col}>
        <a className={classes.link} href={blog}>
          <FAIcon type="medium" />
        </a>
      </div>
      <div className={classes.col}>
        <p className={classes.small}>
          &copy;&nbsp;
          <FormattedMessage {...messages.copy} />
        </p>
      </div>
    </footer>
  ),
)
