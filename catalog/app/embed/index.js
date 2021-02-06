/* embed/index.js - embedded browser entry point */
import * as React from 'react'
import ReactDOM from 'react-dom'

import { translationMessages } from '../i18n'

import Embed from './Embed'

ReactDOM.render(<Embed messages={translationMessages} />, document.getElementById('app'))
