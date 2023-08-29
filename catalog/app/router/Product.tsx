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
      {
        path: routes.uriResolver.path,
        lazy: () => require('pages/Uri'),
      },
      developmentOnly({
        path: '/__example',
        lazy: () => require('pages/Example'),
      }),
      {
        path: routes.admin.path,
        lazy: () => require('pages/Admin/Admin'),
        children: [
          {
            path: routes.adminUsers.path,
            lazy: () => require('pages/Admin/UsersAndRoles'),
          },
          {
            path: routes.adminBuckets.path,
            lazy: () => require('pages/Admin/Buckets'),
          },
          {
            path: routes.adminSettings.path,
            lazy: () => require('pages/Admin/Settings'),
          },
          {
            path: routes.adminSync.path,
            lazy: () => require('pages/Admin/Sync'),
          },
          {
            path: routes.adminStatus.path,
            lazy: () => require('pages/Admin/Status'),
          },
        ],
      },
      {
        path: routes.bucketRoot.path,
        lazy: () => require('pages/Bucket/Bucket'),
        children: [
          {
            path: routes.bucketOverview.path,
            lazy: () => require('pages/Bucket/Overview'),
          },
          {
            path: routes.bucketDir.path,
            lazy: () => require('pages/Bucket/Tree'),
          },
          {
            path: routes.bucketPackageList.path,
            lazy: () => require('pages/Bucket/PackageList'),
          },
          {
            path: routes.bucketPackageRevisions.path,
            lazy: () => require('pages/Bucket/PackageRevisions'),
          },
          {
            path: routes.bucketPackageRevisions.path,
            lazy: () => require('pages/Bucket/PackageTree'),
          },
        ],
      },
    ],
  },
])
