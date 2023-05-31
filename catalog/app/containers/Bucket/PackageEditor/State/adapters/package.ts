import type { TreeEntry } from 'components/FileManager/FileTree'

import type { ValidationEntry } from '../../../PackageDialog/PackageDialog'

export default function convertTreeToFilesMap(
  entries: TreeEntry[],
  prefix: string,
): ValidationEntry[] {
  return entries.reduce((memo, entry) => {
    if (!entry.children) {
      return memo.concat({
        logical_key: `${prefix}${entry.name}`,
        size: entry.size,
      } as ValidationEntry)
    }

    return [...memo, ...convertTreeToFilesMap(entry.children, entry.name)]
  }, [] as ValidationEntry[])
}
