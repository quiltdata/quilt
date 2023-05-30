import type { FileWithPath } from 'react-dropzone'

import { Status } from 'components/FileManager/FileRow'
import type { TreeEntry } from 'components/FileManager/FileTree'
import * as s3paths from 'utils/s3paths'

import { calcChildren, sortEntries } from './utils'

export default function convertDesktopFilesToTree(files: FileWithPath[]): TreeEntry[] {
  const rootMap = files.reduce((memo, file) => {
    const filePath = s3paths.withoutPrefix('/', file.path || file.name)
    const pathParts = filePath.split('/')

    if (pathParts.length === 1) {
      return {
        ...memo,
        [filePath]: {
          id: filePath,
          name: filePath,
          size: file.size,
          status: Status.Unchanged,
        },
      }
    }

    const [head, ...tail] = pathParts
    const dir =
      memo[head] ||
      ({
        id: head,
        name: s3paths.ensureSlash(head),
        size: 0,
        status: Status.Unchanged,
        children: [],
      } as TreeEntry)

    dir.children = sortEntries(calcChildren(file, tail, dir.children))

    return {
      ...memo,
      [head]: dir,
    }
  }, {} as Record<string, TreeEntry>)
  return sortEntries(Object.values(rootMap))
}
