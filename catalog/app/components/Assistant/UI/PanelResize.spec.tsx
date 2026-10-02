import * as React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { MIN_WIDTH, ResizeHandle, clamp } from './PanelResize'

const KEY = 'QUILT_QURATOR_PANEL_WIDTH'
const cssWidth = () =>
  document.documentElement.style.getPropertyValue('--qurator-panel-width')
const handle = () => screen.getByRole('separator', { name: 'Resize Qurator panel' })

describe('components/Assistant/UI/PanelResize', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.style.removeProperty('--qurator-panel-width')
    window.innerWidth = 1200 // max = min(60vw, 900) = 720
  })
  afterEach(cleanup)

  it('clamps to at least the minimum and at most min(60vw, 900px)', () => {
    expect(clamp(100)).toBe(MIN_WIDTH)
    expect(clamp(500)).toBe(500)
    expect(clamp(5000)).toBe(720)
    window.innerWidth = 2000
    expect(clamp(5000)).toBe(900)
  })

  it('steps with the arrow keys, jumps with Home and End, and remembers the width', () => {
    localStorage.setItem(KEY, '500')
    render(<ResizeHandle />)
    expect(handle().getAttribute('aria-valuenow')).toBe('500')
    expect(cssWidth()).toContain('500px')

    fireEvent.keyDown(handle(), { key: 'ArrowLeft' })
    expect(handle().getAttribute('aria-valuenow')).toBe('516')
    fireEvent.keyDown(handle(), { key: 'ArrowRight' })
    fireEvent.keyDown(handle(), { key: 'ArrowRight' })
    expect(handle().getAttribute('aria-valuenow')).toBe('484')
    expect(localStorage.getItem(KEY)).toBe('484')

    fireEvent.keyDown(handle(), { key: 'End' })
    expect(handle().getAttribute('aria-valuenow')).toBe('720')
    fireEvent.keyDown(handle(), { key: 'Home' })
    expect(handle().getAttribute('aria-valuenow')).toBe(String(MIN_WIDTH))
    expect(localStorage.getItem(KEY)).toBe(String(MIN_WIDTH))
  })

  it('keeps the responsive default when nothing is stored', () => {
    render(<ResizeHandle />)
    expect(cssWidth()).toBe('')
    expect(handle().getAttribute('aria-valuemin')).toBe(String(MIN_WIDTH))
    expect(handle().getAttribute('aria-valuemax')).toBe('720')
  })

  it('ignores a stored value that is not a width', () => {
    localStorage.setItem(KEY, 'wide')
    render(<ResizeHandle />)
    expect(cssWidth()).toBe('')
  })

  describe('dragging', () => {
    beforeEach(() => {
      // jsdom has no pointer capture.
      HTMLElement.prototype.setPointerCapture = () => {}
      Object.defineProperty(document.documentElement, 'clientWidth', {
        configurable: true,
        value: 1200,
      })
    })

    // jsdom has no PointerEvent; a MouseEvent of the pointer type carries the same fields.
    const pointer = (type: string, clientX: number) =>
      handle().dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX }))

    it('reports the responsive default before anything is stored', () => {
      render(<ResizeHandle />)
      expect(handle().getAttribute('aria-valuenow')).toBe('600') // min(640, 1200 / 2)
    })

    it('stores the dragged width and leaves the page as it found it', () => {
      render(<ResizeHandle />)
      pointer('pointerdown', 0)
      expect(document.body.hasAttribute('data-qurator-resizing')).toBe(true)
      pointer('pointermove', 700)
      expect(cssWidth()).toContain('500px')
      pointer('pointerup', 700)
      expect(document.body.hasAttribute('data-qurator-resizing')).toBe(false)
      expect(document.body.style.userSelect).toBe('')
      expect(localStorage.getItem(KEY)).toBe('500')
    })

    it('does not pin the default on a click without a drag', () => {
      render(<ResizeHandle />)
      pointer('pointerdown', 0)
      pointer('pointerup', 0)
      expect(localStorage.getItem(KEY)).toBeNull()
    })

    it('restores the page when unmounted mid-drag', () => {
      const { unmount } = render(<ResizeHandle />)
      pointer('pointerdown', 0)
      pointer('pointermove', 700)
      unmount()
      expect(document.body.hasAttribute('data-qurator-resizing')).toBe(false)
      expect(document.body.style.userSelect).toBe('')
      expect(localStorage.getItem(KEY)).toBe('500')
    })
  })
})
