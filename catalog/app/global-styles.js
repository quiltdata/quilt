import * as React from 'react'
import { CssBaseline } from '@material-ui/core'
import { makeStyles } from '@material-ui/styles'

const useGlobalStyles = makeStyles({
  '@global': {
    'html, body': {
      cursor: 'auto',
      textRendering: 'optimizeLegibility',
      height: '100%',
      width: '100%',
      wordBreak: 'normal',
    },
    a: {
      color: 'inherit',
      textDecoration: 'none',
    },
    'code, kbd, pre, samp': {
      fontFamily: "'Roboto Mono', monospace",
    },
    h1: {
      // reset margin set by sanitize.css
      margin: 0,
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
