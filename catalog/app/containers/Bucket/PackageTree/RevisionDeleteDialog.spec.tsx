import * as React from 'react'
import * as M from '@material-ui/core'
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'

import * as style from 'constants/style'

import RevisionDeleteDialog, { type DeleteScope } from './RevisionDeleteDialog'

const HASH = 'a'.repeat(64)

const themed = (el: React.ReactElement) => (
  <M.MuiThemeProvider theme={style.appTheme}>{el}</M.MuiThemeProvider>
)

function mount(
  scope: DeleteScope,
  props: Partial<React.ComponentProps<typeof RevisionDeleteDialog>> = {},
) {
  return render(
    themed(
      <RevisionDeleteDialog
        loading={false}
        name="team/dataset"
        onClose={() => {}}
        onDelete={() => {}}
        open
        scope={scope}
        {...props}
      />,
    ),
  )
}

describe('containers/Bucket/PackageTree/RevisionDeleteDialog', () => {
  it('names what is being deleted for each scope', () => {
    expect(
      mount({ type: 'revision', hash: HASH }).getByRole('heading').textContent,
    ).toContain(HASH.slice(0, 10))
    expect(
      mount({ type: 'revisions', count: 3 }).getByRole('heading').textContent,
    ).toContain('3 revisions')
    expect(mount({ type: 'package' }).getByRole('heading').textContent).toContain(
      'all of its revisions',
    )
  })

  it('confirms and does not close while loading', () => {
    const onDelete = vi.fn()
    const onClose = vi.fn()
    const { getByText, rerender } = mount({ type: 'package' }, { onDelete, onClose })
    fireEvent.click(getByText('Yes, delete it'))
    expect(onDelete).toHaveBeenCalledTimes(1)

    rerender(
      themed(
        <RevisionDeleteDialog
          loading
          name="team/dataset"
          onClose={onClose}
          onDelete={onDelete}
          open
          scope={{ type: 'package' }}
        />,
      ),
    )
    fireEvent.click(getByText('Cancel'))
    expect(onClose).not.toHaveBeenCalled()
  })
})
