import * as React from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type * as FileEditor from 'components/FileEditor'

import { QuickPreview, isQuickPreviewAvailable } from './index'

vi.mock('./Markdown', async () => ({
  ...(await vi.importActual('./Markdown')),
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
      const { container } = render(
        <QuickPreview {...{ handle, type: { brace: 'markdown' as const }, value: '' }} />,
      )
      expect(container.firstChild).toMatchSnapshot()
    })

    it('renders no preview if unsupported file type', () => {
      const { container } = render(
        <QuickPreview {...{ handle, type: { brace: 'json' as const }, value: '' }} />,
      )
      expect(container.firstChild).toMatchSnapshot()
    })

    it('renders Markdown', () => {
      const { container } = render(
        <QuickPreview
          {...{ handle, type: { brace: 'markdown' as const }, value: '=== Title' }}
        />,
      )
      expect(container.firstChild).toMatchSnapshot()
    })
  })
})
