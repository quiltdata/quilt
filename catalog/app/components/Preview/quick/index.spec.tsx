import * as React from 'react'
import renderer from 'react-test-renderer'

import type * as FileEditor from 'components/FileEditor'

import { QuickPreview, isQuickPreviewAvailable } from './index'

jest.mock('./Markdown', () => ({
  ...jest.requireActual('./Markdown'),
  Render: () => <h1>This is Markdown quick preview</h1>,
}))

describe('app/components/Preview/quick/index.spec.tsx', () => {
  describe('isQuickPreviewAvailable', () => {
    it('should say if quick preview is available', () => {
      const types: FileEditor.EditorInputType[] = [
        'markdown' as const,
        'json' as const,
        null,
      ].map((brace) => ({ brace }))
      expect(types.map(isQuickPreviewAvailable)).toEqual([true, false, false])
    })
  })

  describe('QuickPreview', () => {
    const handle = {
      bucket: 'foo',
      key: 'bar',
    }

    it('renders no value', () => {
      const tree = renderer
        .create(
          <QuickPreview
            {...{ handle, type: { brace: 'markdown' as const }, value: '' }}
          />,
        )
        .toJSON()
      expect(tree).toMatchSnapshot()
    })

    it('renders no preview if unsupported file type', () => {
      const tree = renderer
        .create(
          <QuickPreview {...{ handle, type: { brace: 'json' as const }, value: '' }} />,
        )
        .toJSON()
      expect(tree).toMatchSnapshot()
    })

    it('renders Markdown', () => {
      const tree = renderer
        .create(
          <QuickPreview
            {...{ handle, type: { brace: 'markdown' as const }, value: '=== Title' }}
          />,
        )
        .toJSON()
      expect(tree).toMatchSnapshot()
    })
  })
})
