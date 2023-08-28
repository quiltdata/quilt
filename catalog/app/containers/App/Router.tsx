import * as React from 'react'
import { RouteObject, createBrowserRouter } from 'react-router-dom'

import Wrapper from 'pages/Wrapper'

import Error from './Error'

const developmentOnly = (r: RouteObject) =>
  process.env.NODE_ENV === 'development' ? r : {}

export default createBrowserRouter([
  {
    path: '/',
    element: <Wrapper />,
    errorElement: <Error />,
    children: [
      {
        path: '',
        lazy: () => require('pages/Home'),
      },
      {
        path: 'uri',
        lazy: () => require('pages/Uri'),
      },
      developmentOnly({
        path: '__example',
        lazy: () => require('pages/Example'),
      }),
    ],
  },
])
