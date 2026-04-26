import * as React from 'react'
import { afterEach, describe, it, expect, vi } from 'vitest'
import { ThemeProvider, createMuiTheme } from '@material-ui/core/styles'
import { cleanup, fireEvent, render } from '@testing-library/react'

vi.mock('constants/config', () => ({ default: {} }))

vi.mock('components/Logo', () => ({
  default: ({ src }: { src: string }) => <div data-testid="logo" data-src={src} />,
}))

import { InputFile } from './ThemeEditor'

const theme = createMuiTheme()

function renderWithTheme(component: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>)
}

describe('containers/Admin/Settings/ThemeEditor', () => {
  afterEach(cleanup)

  describe('InputFile', () => {
    it('renders placeholder when value is empty', () => {
      const { container, queryByTestId } = renderWithTheme(
        <InputFile input={{ value: '', onChange: vi.fn() }} />,
      )
      expect(queryByTestId('logo')).toBeNull()
      expect(container.querySelector('img')).toBeNull()
    })

    it('renders Logo when value is a URL string', () => {
      const { getByTestId, container } = renderWithTheme(
        <InputFile
          input={{ value: 's3://bucket/catalog/logo.png', onChange: vi.fn() }}
        />,
      )
      expect(getByTestId('logo').getAttribute('data-src')).toBe(
        's3://bucket/catalog/logo.png',
      )
      expect(container.querySelector('img')).toBeNull()
    })

    it('creates and revokes object URL for File value', () => {
      const createSpy = vi
        .spyOn(URL, 'createObjectURL')
        .mockReturnValue('blob:preview-url')
      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

      const file = new File(['x'], 'logo.png', { type: 'image/png' })
      const { container, unmount } = renderWithTheme(
        <InputFile input={{ value: file, onChange: vi.fn() }} />,
      )

      expect(createSpy).toHaveBeenCalledWith(file)
      const img = container.querySelector('img')
      expect(img).not.toBeNull()
      expect(img!.getAttribute('src')).toBe('blob:preview-url')

      unmount()
      expect(revokeSpy).toHaveBeenCalledWith('blob:preview-url')

      createSpy.mockRestore()
      revokeSpy.mockRestore()
    })

    it('updates URL value via text field', () => {
      const onChange = vi.fn()
      const { container } = renderWithTheme(<InputFile input={{ value: '', onChange }} />)
      const textField = container.querySelector(
        'input[placeholder="https://example.com/logo.png"]',
      ) as HTMLInputElement | null
      expect(textField).not.toBeNull()
      fireEvent.change(textField!, { target: { value: 'https://example.com/x.png' } })
      expect(onChange).toHaveBeenCalledWith('https://example.com/x.png')
    })
  })
})
