import { describe, it, expect } from 'vitest'

import {
  addColumnAfter,
  addRowAfter,
  changeValue,
  emptyFile,
  init,
  parse,
  removeColumn,
  stringify,
} from './State'
import type { Layout } from './State'

const ID = expect.any(String)

describe('components/FileEditor/QuiltConfigEditor/QuiltSummarize/State', () => {
  describe('emptyFile', () => {
    it('should return an empty file', () => {
      expect(emptyFile).toEqual({ path: '', isExtended: false })
    })
  })
  describe('init', () => {
    it('should return an initial layout', () => {
      expect(init()()).toEqual({
        rows: [
          {
            id: ID,
            columns: [{ id: ID, file: { path: '', isExtended: false } }],
          },
        ],
      })
    })
    it('should return an parsed layout', () => {
      const parsed = { rows: [] }
      expect(init(parsed)()).toBe(parsed)
    })
  })

  describe('addRowAfter', () => {
    it('adds row', () => {
      const layout = {
        rows: [
          { id: '1', columns: [] },
          { id: '2', columns: [] },
        ],
      }
      expect(addRowAfter('1')(layout)).toEqual({
        rows: [
          { id: '1', columns: [] },
          { id: ID, columns: [{ id: ID, file: emptyFile }] },
          { id: '2', columns: [] },
        ],
      })
    })
  })

  describe('addColumn', () => {
    it('adds column', () => {
      const layout = {
        rows: [
          { id: '1', columns: [] },
          {
            id: '2',
            columns: [
              { id: '21', file: emptyFile },
              { id: '22', file: emptyFile },
            ],
          },
          { id: '3', columns: [] },
        ],
      }
      const file = { path: 'foo', isExtended: false }
      expect(addColumnAfter('2', '21')(file)(layout)).toEqual({
        rows: [
          { id: '1', columns: [] },
          {
            id: '2',
            columns: [
              { id: '21', file: emptyFile },
              { id: ID, file },
              { id: '22', file: emptyFile },
            ],
          },
          { id: '3', columns: [] },
        ],
      })
    })
  })

  describe('changeValue', () => {
    it('changes value', () => {
      const file = { path: 'foo', title: 'bar', description: 'baz', isExtended: true }
      const layout = {
        rows: [
          { id: '1', columns: [] },
          {
            id: '2',
            columns: [
              { id: '21', file: emptyFile },
              { id: '22', file },
              { id: '23', file: emptyFile },
            ],
          },
          { id: '3', columns: [] },
        ],
      }
      expect(changeValue('2', '22')({ title: 'oof', path: 'rab' })(layout)).toEqual({
        rows: [
          { id: '1', columns: [] },
          {
            id: '2',
            columns: [
              { id: '21', file: emptyFile },
              {
                id: '22',
                file: { path: 'rab', title: 'oof', description: 'baz', isExtended: true },
              },
              { id: '23', file: emptyFile },
            ],
          },
          { id: '3', columns: [] },
        ],
      })
    })
  })

  describe('removeColumn', () => {
    it('removes column', () => {
      const layout = {
        rows: [
          { id: '1', columns: [] },
          {
            id: '2',
            columns: [
              { id: '21', file: emptyFile },
              { id: '22', file: emptyFile },
              { id: '23', file: emptyFile },
            ],
          },
          { id: '3', columns: [] },
        ],
      }
      expect(removeColumn('2', '22')(layout)).toEqual({
        rows: [
          { id: '1', columns: [] },
          {
            id: '2',
            columns: [
              { id: '21', file: emptyFile },
              { id: '23', file: emptyFile },
            ],
          },
          { id: '3', columns: [] },
        ],
      })
    })
    it('removes row', () => {
      const layout = {
        rows: [
          { id: '1', columns: [] },
          {
            id: '2',
            columns: [{ id: '21', file: emptyFile }],
          },
        ],
      }
      expect(removeColumn('2', '21')(layout)).toEqual({
        rows: [{ id: '1', columns: [] }],
      })
    })
  })

  describe('parse and stringify', () => {
    const quiltSummarize = `[
  "foo",
  [
    "left",
    "right"
  ],
  {
    "types": [
      "json"
    ],
    "path": "baz",
    "description": "Desc",
    "title": "Title",
    "expand": true,
    "width": "1px"
  },
  {
    "types": [
      {
        "name": "perspective",
        "style": {
          "height": "2px"
        },
        "config": {
          "columns": [
            "a",
            "b"
          ]
        },
        "settings": true
      }
    ],
    "path": "any"
  }
]`
    const layout = {
      rows: [
        { columns: [{ file: { path: 'foo', isExtended: false } }] },
        { columns: [{ file: { path: 'left' } }, { file: { path: 'right' } }] },
        {
          columns: [
            {
              file: {
                path: 'baz',
                description: 'Desc',
                title: 'Title',
                expand: true,
                width: '1px',
                type: { name: 'json' },
              },
            },
          ],
        },
        {
          columns: [
            {
              file: {
                path: 'any',
                type: {
                  name: 'perspective',
                  style: {
                    height: '2px',
                  },
                  config: { columns: ['a', 'b'] },
                  settings: true,
                },
              },
            },
          ],
        },
      ],
    }

    it('parse config and make all shortcuts objects', () => {
      expect(parse(quiltSummarize)).toMatchObject(layout)
    })

    it('convert layout state back to config', () => {
      expect(stringify(layout as Layout)).toBe(quiltSummarize)
    })
  })
})
