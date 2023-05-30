import { Status } from 'components/FileManager/FileRow'
import type { TreeEntry } from 'components/FileManager/FileTree'
import type * as Model from 'model'
import * as s3paths from 'utils/s3paths'

import { calcChildren, sortEntries } from './utils'

export default function convertFilesMapToTree(
  map: Model.PackageContentsFlatMap,
): TreeEntry[] {
  const rootMap = Object.entries(map).reduce((memo, [name, entry]) => {
    const pathParts = name.split('/')

    if (pathParts.length === 1) {
      return {
        ...memo,
        [name]: {
          id: entry.physicalKey,
          name,
          size: entry.size,
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

    dir.children = sortEntries(calcChildren(entry, tail, dir.children))

    return {
      ...memo,
      [head]: dir,
    }
  }, {} as Record<string, TreeEntry>)
  return sortEntries(Object.values(rootMap))
}
