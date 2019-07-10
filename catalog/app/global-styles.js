import * as React from 'react'
import { CssBaseline } from '@material-ui/core'
import { makeStyles } from '@material-ui/styles'

// TODO: clean up
const useGlobalStyles = makeStyles({
  '@global': {
    'html, body': {
      cursor: 'auto',
      textRendering: 'optimizeLegibility',
      height: '100%',
      width: '100%',
      wordBreak: 'normal',
    },

    body: {
      // font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif,
    },

    a: {
      color: 'inherit',
      textDecoration: 'none',
    },
    'code, pre': {
      // backgroundColor: '#eee',
    },
    dt: {
      // color: headerColor,
    },
    dd: {
      // marginLeft: 0,
      // marginBottom: '1em',
    },
    'h1, h2, h3, h4, h5, h6': {
      // color: headerColor,
      // fontWeight: 'lighter',
    },
    h1: {
      // fontSize: '2em',
      // overflow: 'hidden',
      // textOverflow: 'ellipsis',
    },
    h2: {
      // fontSize: '1.5em',
    },
    h3: {
      // fontSize: '1.4em',
    },
    h4: {
      // fontSize: '1.3em',
    },
    h5: {
      // fontSize: '1.2em',
    },
    h6: {
      // fontSize: '1.1em',
    },
    pre: {
      // border: '1px solid rgb(220, 220, 220)',
      // borderRadius: '5px',
      // overflow: 'auto',
      // padding: '.5em',
    },
    'p, label, li, dd': {
      // fontSize: bodySize,
      // lineHeight: '1.5em',
    },

    /* per app.js fontObservers, fontLoaded is fired once Roboto is ready */
    /*
    'body.fontLoaded': {
      // fontFamily: "'Roboto', 'Helvetica Neue', Helvetica, Arial, sans-serif",

      '.fixed, code, kbd, pre, samp': {
        // fontFamily: "'Roboto Mono', monospace",
      },

      'p, label, li, dd': {
        // font-weight: lighter,
      },
    },
    */

    '#app': {
      // minWidth: '100%',
    },
  },
})

const GlobalStyles = () => {
  useGlobalStyles()
  return null
}

export default ({ children }) => (
  <CssBaseline>
    <GlobalStyles />
    {children}
  </CssBaseline>
)
