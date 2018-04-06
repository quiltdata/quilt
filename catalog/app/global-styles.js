import { injectGlobal } from 'styled-components';

import { appBackgroundColor, backgroundColor, bodyColor, bodySize, headerColor } from 'constants/style';

/* eslint no-unused-expressions: 0 */
injectGlobal`
  html,
  body {
    background-color: ${backgroundColor};
    text-rendering: optimizeLegibility;
    height: 100%;
    width: 100%;
  }
  body {
    color: ${bodyColor};
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    a {
      color: #0f4a8c;
      text-decoration: none;
    }
    a:hover,
    a:focus {
      color: #1a5fad;
      cursor: pointer;
      text-decoration: underline;
    }
    a:focus {
      outline: 5px auto -webkit-focus-ring-color;
      outline-offset: -2px;
    }
    a:visited {
      color: #0f4a8c;
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

    hr {
      border-style: none none solid none;
      border-width: 1px;
      opacity: 0.2;
    }

    h1, h2, h3, h4, h5, h6 {
      font-weight: lighter;
    }

    h1 {
      color: ${headerColor};
      font-size: 2em;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    h2 {
      color: ${headerColor};
      font-size: 1.5em;
    }

    h3 {
      color: ${headerColor};
      font-size: 1.4em;
    }

    h4 {
      color: ${headerColor};
      font-size: 1.3em;
    }

    h5 {
      color: ${headerColor};
      font-size: 1.2em;
    }

    h6 {
      color: ${headerColor};
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

    table {
      max-width: 100%;
      width: 100%;
      tr {
        th {
          line-height: 1.5em;
          padding: 8px;
        }
        td {
          line-height: 1.5em;
          padding: 8px;
        }
      }
    }

    table, th, td {
      border: 1px solid #ddd;
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
      font-weight: lighter;
    }

  }

  #app {
    background-color: ${appBackgroundColor};
    min-width: 100%;
  }
`;
