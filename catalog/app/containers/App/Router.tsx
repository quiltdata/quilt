import * as React from 'react'
import { createBrowserRouter } from 'react-router-dom'

import Wrapper from 'pages/Wrapper'

import Error from './Error'

const Home = {
  path: '',
  lazy: () => require('pages/Home'),
}

const Uri = {
  path: 'uri',
  lazy: () => require('pages/Uri'),
}

const Example =
  process.env.NODE_ENV === 'development'
    ? {
        path: '__example',
        lazy: () => require('pages/Example'),
      }
    : {}

export default createBrowserRouter([
  {
    path: '/',
    element: <Wrapper />,
    errorElement: <Error />,
    children: [Home, Uri, Example],
  },
])
