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
      developmentOnly({
        path: '__example',
        lazy: () => require('pages/Example'),
      }),
      {
        path: 'install',
        lazy: () => require('pages/Marketing/Install'),
      },
      {
        path: 'about',
        lazy: () => require('pages/Marketing/About'),
      },
      {
        path: 'personas',
        lazy: () => require('pages/Marketing/Personas'),
      },
      {
        path: 'product',
        lazy: () => require('pages/Marketing/Product'),
      },
      {
        path: 'bioit',
        lazy: () => require('pages/Marketing/BioIT'),
      },
      {
        path: 'nextflow',
        lazy: () => require('pages/Marketing/NextFlow'),
      },
      {
        path: 'aws',
        lazy: () => require('pages/Marketing/BioIT'),
      },
      {
        path: 'aws-marketplace',
        lazy: () => require('pages/Marketing/AwsMarketplace'),
      },
    ],
  },
])
