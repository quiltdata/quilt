import * as React from 'react'
import { render, fireEvent, screen } from '@testing-library/react'
import * as Icons from '@material-ui/icons'
import { describe, it, expect } from 'vitest'

import WithPopover from './WithPopover'

describe('components/Buttons/WithPopover', () => {
  it('should not render children when popup is closed', () => {
    render(
      <WithPopover label="Test Button">
        <div data-testid="popup-content">Popup Content</div>
      </WithPopover>,
    )

    expect(screen.queryByTestId('popup-content')).toBeNull()
  })

  it('should render children when popup is opened', () => {
    render(
      <WithPopover label="Test Button">
        <div data-testid="popup-content">Popup Content</div>
      </WithPopover>,
    )

    const button = screen.getByRole('button', { name: /test button/i })
    fireEvent.click(button)

    expect(screen.getByTestId('popup-content')).toBeTruthy()
  })

  it('should render button with icon when icon prop is provided', () => {
    render(
      <WithPopover icon={Icons.Add} label="Add Item">
        <div>Popup Content</div>
      </WithPopover>,
    )

    // Should use Iconized component which includes the icon
    const button = screen.getByRole('button', { name: /add item/i })
    expect(button).toBeTruthy()
  })

  it('should render button without icon when no icon prop is provided', () => {
    render(
      <WithPopover label="No Icon Button">
        <div>Popup Content</div>
      </WithPopover>,
    )

    // Should use regular Material-UI Button
    const button = screen.getByRole('button', { name: /no icon button/i })
    expect(button).toBeTruthy()
    expect(button.textContent).toContain('No Icon Button')
  })

  it('should render button with string icon', () => {
    render(
      <WithPopover icon="add" label="String Icon Button">
        <div>Popup Content</div>
      </WithPopover>,
    )

    const button = screen.getByRole('button', { name: /string icon button/i })
    expect(button).toBeTruthy()
  })

  it('should close popup when backdrop is clicked', () => {
    const { container } = render(
      <WithPopover label="Test Button">
        <div data-testid="popup-content">Popup Content</div>
      </WithPopover>,
    )

    const button = screen.getByRole('button', { name: /test button/i })
    fireEvent.click(button)

    expect(screen.getByTestId('popup-content')).toBeTruthy()

    const backdrop = container.querySelector('.MuiBackdrop-root') as HTMLElement
    if (backdrop) {
      fireEvent.click(backdrop)
    }

    expect(screen.queryByTestId('popup-content')).toBeNull()
  })

  it('should close popup when paper is clicked', () => {
    const { container } = render(
      <WithPopover label="Test Button">
        <div data-testid="popup-content">Popup Content</div>
      </WithPopover>,
    )

    const button = screen.getByRole('button', { name: /test button/i })
    fireEvent.click(button)

    expect(screen.getByTestId('popup-content')).toBeTruthy()

    const paper = container.querySelector('.MuiPaper-root')
    if (paper) {
      fireEvent.click(paper)
    }

    expect(screen.queryByTestId('popup-content')).toBeNull()
  })

  it('should toggle popup state on button click', () => {
    render(
      <WithPopover label="Toggle Button">
        <div data-testid="popup-content">Popup Content</div>
      </WithPopover>,
    )

    const button = screen.getByRole('button', { name: /toggle button/i })

    // Initially closed
    expect(screen.queryByTestId('popup-content')).toBeNull()

    // Click to open
    fireEvent.click(button)
    expect(screen.getByTestId('popup-content')).toBeTruthy()

    // Click to close
    fireEvent.click(button)
    expect(screen.queryByTestId('popup-content')).toBeNull()
  })
})
