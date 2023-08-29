import * as React from 'react'
import { useParams } from 'react-router-dom'

import Placeholder from 'components/Placeholder'
import * as RT from 'utils/reactTools'

import { authenticatedOnly } from '../utils'

const Dir: (p: {}) => JSX.Element = authenticatedOnly(
  RT.mkLazy(() => import('containers/Bucket/Dir'), Placeholder),
)

const File: (p: {}) => JSX.Element = authenticatedOnly(
  RT.mkLazy(() => import('containers/Bucket/File'), Placeholder),
)

export const Component: React.FC = () => {
  const { ['*']: path } = useParams()
  const isDir = !path || path?.endsWith('/')
  return isDir ? <Dir /> : <File />
}
