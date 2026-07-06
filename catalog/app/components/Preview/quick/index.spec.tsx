import * as React from 'react'
import { render, cleanup } from '@testing-library/react'
import { describe, expect, it, vi, afterEach } from 'vitest'

import type * as FileEditor from 'components/FileEditor'

import { QuickPreview, isQuickPreviewAvailable } from './index'

vi.mock('./Markdown', async () => ({
  ...(await vi.importActual('./Markdown')),
  Render: () => <h1>This is Markdown quick preview</h1>,
}))

describe('app/components/Preview/quick/index.spec.tsx', () => {
  afterEach(cleanup)

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
      const { getByText } = render(
        <QuickPreview {...{ handle, type: { brace: 'markdown' as const }, value: '' }} />,
      )
      expect(getByText('There is no content for quick preview')).toBeTruthy()
    })

    it('renders no preview if unsupported file type', () => {
      const { getByText } = render(
        <QuickPreview {...{ handle, type: { brace: 'json' as const }, value: '' }} />,
      )
      expect(getByText('There is no content for quick preview')).toBeTruthy()
    })

    it('renders Markdown', () => {
      const { getByText } = render(
        <QuickPreview
          {...{ handle, type: { brace: 'markdown' as const }, value: '=== Title' }}
        />,
      )
      expect(getByText('This is Markdown quick preview')).toBeTruthy()
    })
  })
})
