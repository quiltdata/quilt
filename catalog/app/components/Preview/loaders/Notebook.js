import katex from 'katex'
import splitAtDelimiters from 'katex/contrib/auto-render/splitAtDelimiters'
import * as R from 'ramda'

import AsyncResult from 'utils/AsyncResult'

import { PreviewData } from '../types'
import * as utils from './utils'

const MATH_DELIMITERS = [
  { left: '$$', right: '$$', display: true },
  { left: '$', right: '$', display: false },
  { left: '\\(', right: '\\)', display: false },
  { left: '\\[', right: '\\]', display: true },
]

const split = (text) =>
  MATH_DELIMITERS.reduce((acc, d) => splitAtDelimiters(acc, d.left, d.right, d.display), [
    { type: 'text', data: text },
  ])

const renderFragment = (f) => {
  switch (f.type) {
    case 'text':
      return f.data
    case 'math':
      return katex.renderToString(f.data, { throwOnError: false, displayMode: f.display })
    default:
      throw new Error('invalid fragment type')
  }
}

const renderMath = R.pipe(
  split,
  R.into('', R.map(renderFragment)),
)

export const detect = R.pipe(
  utils.stripCompression,
  utils.extIs('.ipynb'),
)

export const load = utils.previewFetcher('ipynb', (json) =>
  AsyncResult.Ok(PreviewData.Notebook({ preview: renderMath(json.html) })),
)
