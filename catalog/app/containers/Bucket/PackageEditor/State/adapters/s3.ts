import { Status } from 'components/FileManager/FileRow'
import type { TreeEntry } from 'components/FileManager/FileTree'
import type * as Model from 'model'
import * as s3paths from 'utils/s3paths'

import { calcChildren, sortEntries } from './utils'

export default function convertS3FilesListToTree(
  path: string,
  files: Model.S3File[],
): TreeEntry[] {
  const rootMap = files.reduce((memo, file) => {
    const filePath = s3paths.withoutPrefix(path, file.key)
    const pathParts = filePath.split('/')
    if (pathParts.length === 1) {
      return {
        ...memo,
        [filePath]: {
          id: filePath,
          name: filePath,
          size: file.size,
          status: Status.S3,
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
        status: Status.S3,
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
