import * as React from 'react'
import { useParams } from 'react-router-dom'

import Placeholder from 'components/Placeholder'
import * as RT from 'utils/reactTools'

const SuspensePlaceholder = () => <Placeholder color="text.secondary" />

const Dir = RT.mkLazy(() => import('embed/Dir'), SuspensePlaceholder)

const File = RT.mkLazy(() => import('embed/File'), SuspensePlaceholder)

export const Component: React.FC = () => {
  const { ['*']: path } = useParams()
  const isDir = !path || path?.endsWith('/')
  return isDir ? <Dir /> : <File />
}
