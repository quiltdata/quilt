import { vi } from 'vitest'

import type * as Model from 'model'

import {
  FileWithHash,
  FilesState,
  LocalFile,
  FilesAction,
  handleFilesAction,
  renameKey,
  renameKeys,
  FilesEntry,
  groupAddedFiles,
  EMPTY_DIR_MARKER,
} from './State'

vi.mock('constants/config', () => ({}))

describe('utils/object', () => {
  describe('renameKey', () => {
    it('should rename key', () => {
      const ref = Symbol('ref')
      const obj = { 'a/b/c': ref, 'd/e/f': 2 }
      const result = renameKey('a/b/c', 'x/y/z', obj)
      expect(result).toEqual({ 'd/e/f': 2, 'x/y/z': ref })
    })
    it('should do nothing (except cloning) if key does not exist', () => {
      const ref = Symbol('ref')
      const obj = { A: ref, 'd/e/f': 2 }
      const result = renameKey('B', 'C', obj)
      expect(result).toEqual(obj)
      expect(result).not.toBe(obj)
    })
  })

  describe('renameKeys', () => {
    it('should rename keys', () => {
      const refA = Symbol()
      const refB = Symbol()
      const refD = Symbol()
      const refE = Symbol()
      const obj = {
        'a/b/c/d.txt': refD,
        'a/b/c/e.txt': refE,
        'x/y/a.txt': refA,
        'x/y/b.txt': refB,
      }
      const result = renameKeys('x/y', 'a/b', obj)
      expect(result).toEqual({
        'a/b/c/d.txt': refD,
        'a/b/c/e.txt': refE,
        'a/b/y/a.txt': refA,
        'a/b/y/b.txt': refB,
      })
    })
  })

  describe('handleFilesAction', () => {
    const emptyState = {
      added: {},
      existing: {},
      deleted: {},
    }
    const initial: { initial: FilesState } = {
      initial: {
        ...emptyState,
      },
    }
    const fileAA = { name: 'foo/bar.txt' } as FileWithHash
    const fileEA = { physicalKey: 's3://b/a' } as Model.PackageEntry
    const fileEAConvertedToAdded = {
      bucket: 'b',
      key: 'a',
    }
    const fileSA = {} as Model.S3File
    const fileSB = {} as Model.S3File
    const fileLA = new window.File([], 'foo.txt') as LocalFile

    describe('Add', () => {
      it('adds the file', () => {
        const action = FilesAction.Add({ files: [fileAA], prefix: '' })
        expect(handleFilesAction(action, initial)(emptyState)).toEqual({
          ...emptyState,
          added: { 'foo/bar.txt': fileAA },
        })
      })
      it('adds the file to prefix', () => {
        const action = FilesAction.Add({ files: [fileAA], prefix: 'root/nested/' })
        expect(handleFilesAction(action, initial)(emptyState)).toMatchObject({
          added: { 'root/nested/foo/bar.txt': fileAA },
        })
      })
    })

    describe('AddFolder', () => {
      it('adds folder with .quiltkeep', () => {
        const action = FilesAction.AddFolder('root/nested/')
        expect(handleFilesAction(action, initial)(emptyState)).toMatchObject({
          added: {
            'root/nested/[$.quiltkeep$]': {
              bucket: '[$empty$]',
              key: '[$empty$]',
              size: 0,
            },
          },
        })
      })
    })

    it('AddFromS3', () => {
      const action = FilesAction.AddFromS3({
        'a/b/c': fileSA,
        'x/y/z': fileSB,
      })
      const state = {
        ...emptyState,
        deleted: {
          'a/b/c': true as const,
        },
      }
      expect(handleFilesAction(action, initial)(state)).toEqual({
        ...state,
        added: {
          'a/b/c': fileSA,
          'x/y/z': fileSB,
        },
        deleted: {},
      })
    })

    it('Delete', () => {
      const action = FilesAction.Delete('a/b/c')
      const state = {
        added: {
          'a/b/c': fileAA,
        },
        existing: {
          'a/b/c': fileEA,
        },
        deleted: {
          'a/b/c': true as const,
        },
      }
      expect(handleFilesAction(action, initial)(state)).toEqual({
        ...state,
        added: {},
      })
    })

    it('DeleteDir', () => {
      const action = FilesAction.DeleteDir('a/b')
      const state = {
        added: {
          'a/b/addedA': fileAA,
          'a/b/addedB': fileAA,
          'a/C/addedC': fileAA,
        },
        existing: {
          'x/y/existingZ': fileEA,
          'a/b/existingD': fileEA,
          'a/b/existingE': fileEA,
        },
        deleted: {
          'a/b/deletedF': true as const,
          'x/y/deletedW': true as const,
        },
      }
      expect(handleFilesAction(action, initial)(state)).toEqual({
        ...state,
        added: {
          'a/C/addedC': fileAA,
        },
        deleted: {
          'a/b/existingD': true as const,
          'a/b/existingE': true as const,
          'a/b/deletedF': true as const,
          'x/y/deletedW': true as const,
        },
      })
    })

    describe('Meta', () => {
      it('adds meta to objects', () => {
        const action = FilesAction.Meta({ path: 'a/b/c', meta: { foo: 'bar' } })
        const state = {
          ...emptyState,
          added: {
            'a/b/c': fileAA,
            'x/y/z': fileLA,
          },
          existing: {
            'a/b/c': fileEA,
          },
        }
        const result = handleFilesAction(action, initial)(state)
        expect(result.added['a/b/c'].meta).toEqual({ foo: 'bar' })
        expect(result.added['x/y/z'].meta).toBe(undefined)
        expect(result.existing['a/b/c'].meta).toEqual({ foo: 'bar' })
      })
      it('adds meta to files', () => {
        const action = FilesAction.Meta({ path: 'x/y/z', meta: { foo: 'bar' } })
        const state = {
          ...emptyState,
          added: {
            'x/y/z': fileLA,
          },
        }
        expect(handleFilesAction(action, initial)(state).added['x/y/z'].meta).toEqual({
          foo: 'bar',
        })
      })
    })

    describe('Move', () => {
      it('Move added file', () => {
        const source = FilesEntry.File({
          name: 'foo.txt',
          state: 'added',
          type: 'local',
          size: 0,
        })
        const dest = FilesEntry.Dir({
          name: 'lorem/ipsum/',
          state: 'unchanged',
          childEntries: [],
        })
        const action = FilesAction.Move({
          source: [source, 'root/inside/'],
          dest: [dest],
        })
        const state = {
          ...emptyState,
          added: {
            'root/inside/foo.txt': fileAA,
          },
        }
        const result = handleFilesAction(action, initial)(state)
        expect(result).toMatchObject({
          added: {
            'lorem/ipsum/foo.txt': fileAA,
          },
        })
      })

      it('Move existing file', () => {
        const source = FilesEntry.File({
          name: 'foo.txt',
          state: 'unchanged',
          type: 'local',
          size: 0,
        })
        const dest = FilesEntry.Dir({
          name: 'lorem/ipsum/',
          state: 'unchanged',
          childEntries: [],
        })
        const action = FilesAction.Move({
          source: [source, 'root/inside/'],
          dest: [dest],
        })
        const state = {
          ...emptyState,
          existing: {
            'root/inside/foo.txt': fileEA,
          },
        }
        const result = handleFilesAction(action, initial)(state)
        expect(result).toMatchObject({
          added: {
            'lorem/ipsum/foo.txt': fileEAConvertedToAdded,
          },
        })
      })

      it('Move added dir', () => {
        const source = FilesEntry.Dir({
          name: 'foo/bar/',
          state: 'unchanged',
          childEntries: [],
        })
        const dest = FilesEntry.Dir({
          name: 'lorem/ipsum/',
          state: 'unchanged',
          childEntries: [],
        })
        const action = FilesAction.Move({
          source: [source, 'root/inside/'],
          dest: [dest],
        })
        const state = {
          ...emptyState,
          added: {
            'root/inside/foo/bar/a.txt': fileAA,
            'root/inside/foo/bar/b.txt': fileAA,
          },
        }
        const result = handleFilesAction(action, initial)(state)
        expect(result).toMatchObject({
          added: {
            'lorem/ipsum/bar/a.txt': fileAA,
            'lorem/ipsum/bar/b.txt': fileAA,
          },
        })
      })

      it('Move existing dir', () => {
        const source = FilesEntry.Dir({
          name: 'foo/bar/',
          state: 'unchanged',
          childEntries: [],
        })
        const dest = FilesEntry.Dir({
          name: 'lorem/ipsum/',
          state: 'unchanged',
          childEntries: [],
        })
        const action = FilesAction.Move({
          source: [source, 'root/inside/'],
          dest: [dest],
        })
        const state = {
          ...emptyState,
          existing: {
            'root/inside/foo/bar/a.txt': fileEA,
            'root/inside/foo/bar/b.txt': fileEA,
          },
        }
        const result = handleFilesAction(action, initial)(state)
        expect(result).toMatchObject({
          added: {
            'lorem/ipsum/bar/a.txt': fileEAConvertedToAdded,
            'lorem/ipsum/bar/b.txt': fileEAConvertedToAdded,
          },
        })
      })

      it('Moving throws error when moving non-existing file', () => {
        const source = FilesEntry.File({
          name: 'foo.txt',
          state: 'unchanged',
          type: 'local',
          size: 0,
        })
        const dest = FilesEntry.Dir({
          name: 'bar',
          state: 'unchanged',
          childEntries: [],
        })
        const action = FilesAction.Move({
          source: [source],
          dest: [dest],
        })
        expect(() => handleFilesAction(action, initial)(emptyState)).toThrowError(
          'Failed to move file',
        )
      })

      it('Moving throws error when moving non-existing directory', () => {
        const source = FilesEntry.Dir({
          name: 'foo',
          state: 'unchanged',
          childEntries: [],
        })
        const dest = FilesEntry.Dir({
          name: 'bar',
          state: 'unchanged',
          childEntries: [],
        })
        const action = FilesAction.Move({
          source: [source],
          dest: [dest],
        })
        expect(() => handleFilesAction(action, initial)(emptyState)).toThrowError(
          'Failed to move directory',
        )
      })
    })

    it('Revert', () => {
      const action = FilesAction.Revert('a/b/c')
      const state = {
        added: {
          'a/b/c': fileAA,
          'x/y/z': fileAA,
        },
        existing: {
          'a/b/c': fileEA,
          'x/y/z': fileEA,
        },
        deleted: {
          'a/b/c': true as const,
          'x/y/z': true as const,
        },
      }
      expect(handleFilesAction(action, initial)(state)).toEqual({
        added: {
          'x/y/z': fileAA,
        },
        deleted: {
          'x/y/z': true as const,
        },
        existing: state.existing,
      })
    })

    it('RevertDir', () => {
      const action = FilesAction.RevertDir('a/b')
      const state = {
        added: {
          'a/b/a': fileAA,
          'a/b/b': fileAA,
          'x/y/z': fileAA,
        },
        existing: {
          'a/b/a': fileEA,
          'a/b/b': fileEA,
          'x/y/z': fileEA,
        },
        deleted: {
          'a/b/a': true as const,
          'a/b/b': true as const,
          'x/y/z': true as const,
        },
      }
      expect(handleFilesAction(action, initial)(state)).toEqual({
        added: {
          'x/y/z': fileAA,
        },
        deleted: {
          'x/y/z': true as const,
        },
        existing: state.existing,
      })
    })

    it('Reset', () => {
      const action = FilesAction.Reset()
      const state = {
        added: {
          any: fileAA,
        },
        existing: {
          any: fileEA,
        },
        deleted: {
          any: true as const,
        },
      }
      const result = handleFilesAction(action, initial)(state)
      expect(result).toEqual({
        added: {},
        existing: {},
        deleted: {},
      })
      expect(result).toBe(initial.initial)
    })
  })

  describe('groupAddedFiles', () => {
    const fileAA = { name: 'foo.txt' } as FileWithHash
    const fileAB = { name: 'bar.js' } as FileWithHash

    const fileSA = { bucket: 'b', key: 'a.txt', size: 100 } as Model.S3File
    const fileSB = { bucket: 'b', key: 'b.jpg', size: 200 } as Model.S3File

    it('should return empty arrays for empty input', () => {
      const result = groupAddedFiles({})
      expect(result).toEqual({ local: [], remote: [] })
    })

    it('should group only local files', () => {
      const added = {
        [fileAA.name]: fileAA,
        [fileAB.name]: fileAB,
      }

      const result = groupAddedFiles(added)

      expect(result.remote).toHaveLength(0)
      expect(result.local).toEqual([
        {
          path: fileAA.name,
          file: fileAA,
        },
        {
          path: fileAB.name,
          file: fileAB,
        },
      ])
    })

    it('should group only remote (S3) files', () => {
      const added = {
        [fileSA.key]: fileSA,
        [fileSB.key]: fileSB,
      }

      const result = groupAddedFiles(added)

      expect(result.local).toHaveLength(0)
      expect(result.remote).toEqual([
        {
          path: fileSA.key,
          file: fileSA,
        },
        {
          path: fileSB.key,
          file: fileSB,
        },
      ])
    })

    it('should group mixed local and remote files', () => {
      const added = {
        [fileAA.name]: fileAA,
        [fileSA.key]: fileSA,
        [fileAB.name]: fileAB,
        [fileSB.key]: fileSB,
      }

      const result = groupAddedFiles(added)

      expect(result.local).toHaveLength(2)
      expect(result.remote).toHaveLength(2)
    })

    it('should filter out EMPTY_DIR_MARKER entries', () => {
      const added = {
        [fileAA.name]: fileAA,
        'empty/folder': EMPTY_DIR_MARKER,
        [fileSA.key]: fileSA,
        'another-empty': EMPTY_DIR_MARKER,
      }

      const result = groupAddedFiles(added)

      expect(result).toEqual({
        local: [{ path: fileAA.name, file: fileAA }],
        remote: [{ path: fileSA.key, file: fileSA }],
      })
    })
  })
})
