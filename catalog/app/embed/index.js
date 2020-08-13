/* embed/index.js - embedded browser entry point */
// Needed for redux-saga es6 generator support
import '@babel/polyfill'

import * as React from 'react'
import ReactDOM from 'react-dom'

import { translationMessages } from '../i18n'

import Embed from './Embed'

const polyfills = []

// Chunked polyfill for browsers without Intl support
if (!window.Intl)
  polyfills.push(
    import('intl').then(() => Promise.all([import('intl/locale-data/jsonp/en.js')])),
  )

if (!window.ResizeObserver)
  polyfills.push(
    import('resize-observer-polyfill').then(({ default: RO }) => {
      window.ResizeObserver = RO
    }),
  )

Promise.all(polyfills).then(() => {
  ReactDOM.render(
    <Embed messages={translationMessages} />,
    document.getElementById('app'),
  )
})
