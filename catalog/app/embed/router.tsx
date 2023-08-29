import * as React from 'react'
import { createBrowserRouter } from 'react-router-dom'

import * as routes from 'constants/embed-routes'
import Wrapper from 'embed/pages/Wrapper'
import { ThrowNotFound } from 'containers/NotFoundPage'

import Error from 'router/Error'

export default createBrowserRouter([
  {
    path: '/',
    element: <Wrapper />,
    errorElement: <Error />,
    children: [
      {
        path: routes.bucketRoot.path,
        lazy: () => require('embed/pages/Bucket'),
        children: [
          {
            path: routes.bucketDir.path,
            lazy: () => require('embed/pages/Tree'),
          },
          {
            path: routes.bucketSearch.path,
            lazy: () => require('embed/pages/Search'),
          },
          {
            index: true,
            path: '*',
            element: <ThrowNotFound />,
          },
        ],
      },
      {
        index: true,
        path: '*',
        element: <ThrowNotFound />,
      },
    ],
  },
])
