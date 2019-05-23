import * as React from 'react'
import { createGlobalStyle } from 'styled-components'

import { bodyColor, bodySize, headerColor } from 'constants/style'

// TODO: deprecate this, use MUI css baseline, theme and typography
/* eslint no-unused-expressions: 0 */
const GlobalStyles = createGlobalStyle`
  html,
  body {
    cursor: auto;
    text-rendering: optimizeLegibility;
    height: 100%;
    width: 100%;
    word-break: normal;
  }

  body {
    color: ${bodyColor};
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;

    a {
      color: inherit;
      text-decoration: none;
    }

    code, pre {
      color: ${bodyColor};
      background-color: #eee;
    }

    .fixed,
    code,
    kbd,
    pre,
    samp {
      font-family: monospace;
    }

    dt {
      color: ${headerColor};
    }

    dd {
      margin-left: 0em;
      margin-bottom: 1em;
    }

    h1, h2, h3, h4, h5, h6 {
      color: ${headerColor};
      font-weight: lighter;
    }

    h1 {
      font-size: 2em;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    h2 {
      font-size: 1.5em;
    }

    h3 {
      font-size: 1.4em;
    }

    h4 {
      font-size: 1.3em;
    }

    h5 {
      font-size: 1.2em;
    }

    h6 {
      font-size: 1.1em;
    }

    pre {
      border: 1px solid rgb(220, 220, 220);
      border-radius: 5px;
      overflow: auto;
      padding: .5em;
    }

    p, label, li, dd {
      font-size: ${bodySize};
      line-height: 1.5em;
    }
  }

  /* per app.js fontObservers, fontLoaded is fired once Roboto is ready */
  body.fontLoaded {
    font-family: 'Roboto', 'Helvetica Neue', Helvetica, Arial, sans-serif;

    .fixed,
    code,
    kbd,
    pre,
    samp {
      font-family: 'Roboto Mono', monospace;
    }

    p, label, li, dd {
      //font-weight: lighter;
    }
  }

  #app {
    min-width: 100%;
  }
`

export default ({ children }) => (
  <>
    <GlobalStyles />
    {children}
  </>
)
