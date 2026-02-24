import * as React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { ThemeOptions, ThemeProvider, createMuiTheme } from '@material-ui/core/styles'
import { render, fireEvent } from '@testing-library/react'

import copyToClipboard from 'utils/clipboard'

import { CopyButton } from './Buttons'

vi.mock('constants/config', () => ({ default: {} }))

vi.mock('utils/clipboard', () => ({ default: vi.fn() }))

const push = vi.fn()
vi.mock('containers/Notifications', () => ({
  use: () => ({ push }),
}))

vi.mock('components/Buttons', () => ({
  usePopoverClose: () => vi.fn(),
}))

const theme = createMuiTheme({
  typography: {
    monospace: {
      fontFamily: 'monospace',
    },
  } as ThemeOptions['typography'],
})

function renderWithTheme(component: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>)
}

describe('containers/Bucket/Download/Buttons', () => {
  describe('CopyButton', () => {
    it('should copy URI to clipboard and show notification on click', () => {
      const uri = 's3://test-bucket/path/to/file'
      const { getByRole } = renderWithTheme(<CopyButton uri={uri} />)
      fireEvent.click(getByRole('button'))
      expect(copyToClipboard).toHaveBeenCalledWith(uri)
      expect(push).toHaveBeenCalledWith('URI has been copied to clipboard')
    })
  })
})
