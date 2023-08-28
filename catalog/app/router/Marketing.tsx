import * as React from 'react'
import { RouteObject, createBrowserRouter } from 'react-router-dom'

import * as routes from 'constants/routes'
import Wrapper from 'pages/Wrapper'

import Error from './Error'

const developmentOnly = (r: RouteObject) =>
  process.env.NODE_ENV === 'development' ? r : {}

export default createBrowserRouter([
  {
    path: routes.home.path,
    element: <Wrapper />,
    errorElement: <Error />,
    children: [
      {
        path: routes.home.path,
        lazy: () => require('pages/Home'),
      },
      developmentOnly({
        path: '__example',
        lazy: () => require('pages/Example'),
      }),
      {
        path: routes.install.path,
        lazy: () => require('pages/Marketing/Install'),
      },
      {
        path: routes.about.path,
        lazy: () => require('pages/Marketing/About'),
      },
      {
        path: routes.personas.path,
        lazy: () => require('pages/Marketing/Personas'),
      },
      {
        path: routes.product.path,
        lazy: () => require('pages/Marketing/Product'),
      },
      {
        path: '/bioit',
        lazy: () => require('pages/Marketing/BioIT'),
      },
      {
        path: '/nextflow',
        lazy: () => require('pages/Marketing/NextFlow'),
      },
      {
        path: '/aws',
        lazy: () => require('pages/Marketing/BioIT'),
      },
      {
        path: '/aws-marketplace',
        lazy: () => require('pages/Marketing/AwsMarketplace'),
      },
    ],
  },
])
