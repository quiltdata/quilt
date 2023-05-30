import type { FileWithPath } from 'react-dropzone'

import { Status } from 'components/FileManager/FileRow'
import type { TreeEntry } from 'components/FileManager/FileTree'
import type * as Model from 'model'
import * as s3paths from 'utils/s3paths'

export function calcChildren(
  entry: Model.PackageEntry | Model.S3File | FileWithPath,
  tailParts: string[],
  children: TreeEntry[] = [],
): TreeEntry[] {
  const [name, ...tail] = tailParts
  const found = children.find((child) => child.id === name)
  if (found) {
    if (tail.length) {
      found.children = calcChildren(entry, tail, found.children)
    }
    return children
  }

  return children.concat({
    id: name,
    name: tail.length ? s3paths.ensureSlash(name) : name,
    size: tail.length ? 0 : entry.size,
    status: Status.Unchanged,
    children: tail.length ? calcChildren(entry, tail, []) : undefined,
  })
}

export function sortEntries(entries: TreeEntry[]): TreeEntry[] {
  return [...entries].sort((a, b) => {
    if (a.children && !b.children) return -1
    if (!a.children && b.children) return 1
    return a.name.localeCompare(b.name)
  })
}
