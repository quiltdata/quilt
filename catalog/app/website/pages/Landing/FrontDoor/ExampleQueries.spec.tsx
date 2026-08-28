import * as React from 'react'
import * as M from '@material-ui/core'
import { render, cleanup, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import * as style from 'constants/style'

const useExampleQueries = vi.hoisted(() =>
  vi.fn(() => [
    { icon: 'search', label: 'drugbank' },
    { icon: 'summarize', label: 'Summarize research on BRCA1 mutations' },
  ]),
)
vi.mock('./useExampleQueries', () => ({ default: useExampleQueries }))

import ExampleQueries from './ExampleQueries'

// The chip styles read app-theme extensions (typography.monospace), so render
// under the same theme the app provides.
const renderChips = (onSelect = vi.fn()) =>
  render(
    <M.MuiThemeProvider theme={style.appTheme}>
      <ExampleQueries onSelect={onSelect} />
    </M.MuiThemeProvider>,
  )

describe('website/pages/Landing/FrontDoor/ExampleQueries', () => {
  afterEach(cleanup)

  it('renders example chips without error', () => {
    const { getByText } = renderChips()
    expect(getByText('drugbank')).toBeTruthy()
  })

  it('prefills the bar via onSelect when a chip is clicked', () => {
    const onSelect = vi.fn()
    const { getByText } = renderChips(onSelect)
    fireEvent.click(getByText('drugbank'))
    expect(onSelect).toHaveBeenCalledWith('drugbank')
  })

  it('wears the outlined icon face the rest of the chrome wears', () => {
    const { container } = renderChips()
    const icons = container.querySelectorAll('.MuiChip-icon')
    expect(icons).toHaveLength(2)
    icons.forEach((icon) => {
      expect(icon.classList.contains('material-icons-outlined')).toBe(true)
    })
  })

  it('sets the code span apart while keeping the label one query', () => {
    const onSelect = vi.fn()
    useExampleQueries.mockReturnValueOnce([
      {
        icon: 'inventory_2',
        label: "What's in the alexwilson/drugbank-test package?",
        code: 'alexwilson/drugbank-test',
      },
    ] as any)
    const { container, getByText } = renderChips(onSelect)
    // The handle is its own element, the rest of the sentence is not.
    expect(getByText('alexwilson/drugbank-test').tagName).toBe('SPAN')
    // ...and the chip still reads, and submits, as one whole query.
    const label = container.querySelector('.MuiChip-label')
    expect(label?.textContent).toBe("What's in the alexwilson/drugbank-test package?")
    fireEvent.click(getByText('alexwilson/drugbank-test'))
    expect(onSelect).toHaveBeenCalledWith(
      "What's in the alexwilson/drugbank-test package?",
    )
  })
})
