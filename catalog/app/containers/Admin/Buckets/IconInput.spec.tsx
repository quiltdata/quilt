import * as React from 'react'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import * as RF from 'react-final-form'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('constants/config', () => ({ default: {} }))

// The cropper needs layout and a canvas, neither of which jsdom has; the crop
// itself is covered by iconCrop.spec.ts and the browser harness.
vi.mock('react-easy-crop', () => ({ default: () => null }))

vi.mock('components/BucketIcon', () => ({
  default: ({ src, tintKey }: { src: string | null; tintKey: string }) => (
    <div data-testid="preview" data-src={src ?? ''} data-tint={tintKey} />
  ),
}))

import IconInput from './IconInput'

interface HarnessProps {
  initial?: string
  bucketName?: string
  errors?: Record<string, React.ReactNode>
  validate?: (v?: string) => string | undefined
}

function Harness({ initial, bucketName, errors, validate }: HarnessProps) {
  return (
    <RF.Form onSubmit={() => {}} initialValues={{ iconUrl: initial, title: 'Prod data' }}>
      {({ handleSubmit }) => (
        <form onSubmit={handleSubmit}>
          <RF.Field
            component={IconInput}
            name="iconUrl"
            bucketName={bucketName}
            errors={errors}
            validate={validate}
          />
        </form>
      )}
    </RF.Form>
  )
}

// MUI v4 wires the label through its own ids, which jsdom does not resolve to a
// control, so the field is found by its placeholder.
const urlField = (q: ReturnType<typeof render>) =>
  q.getByPlaceholderText('e.g. https://some-cdn.com/icon.png') as HTMLInputElement

describe('containers/Admin/Buckets/IconInput', () => {
  afterEach(cleanup)

  it('tints the preview by bucket name, not by title', () => {
    // The row behind the form hashes the bucket's name, so a preview keyed on the
    // title would show one tint in the form and another in the list.
    const q = render(<Harness bucketName="prod-analytics" />)
    expect(q.getByTestId('preview').dataset.tint).toBe('prod-analytics')
  })

  it('falls back to the live title on the add form, where no bucket exists yet', () => {
    const q = render(<Harness />)
    expect(q.getByTestId('preview').dataset.tint).toBe('Prod data')
  })

  it('shows a URL value as itself and keeps it editable', () => {
    const q = render(<Harness initial="https://cdn.example.com/i.png" />)
    const field = urlField(q)
    expect(field.value).toBe('https://cdn.example.com/i.png')
    expect(field.readOnly).toBe(false)
  })

  it('describes a stored data: URI instead of showing it, and refuses edits', () => {
    // Thousands of characters cannot be shown in a text field, and a keystroke in a
    // field showing a truncation would replace the whole stored value.
    const uri = `data:image/png;base64,${'A'.repeat(2000)}`
    const q = render(<Harness initial={uri} />)
    const field = urlField(q)
    expect(field.readOnly).toBe(true)
    expect(field.value).toContain('Uploaded image')
    expect(field.value).not.toContain('AAAA')
    // The preview still renders the real value, so the icon is visible even though
    // the field describes it.
    expect(q.getByTestId('preview').dataset.src).toBe(uri)
  })

  it('trims trailing whitespace on blur but leaves it alone mid-typing', () => {
    const q = render(<Harness initial="" />)
    const field = urlField(q)
    fireEvent.change(field, { target: { value: 'https://cdn.example.com/my icon.png' } })
    // A space inside the value survives: trimming per keystroke made one untypable.
    expect(field.value).toBe('https://cdn.example.com/my icon.png')
    fireEvent.change(field, { target: { value: 'https://cdn.example.com/i.png  ' } })
    fireEvent.blur(field)
    expect(field.value).toBe('https://cdn.example.com/i.png')
  })

  it('strips leading whitespace as the field it replaced did', () => {
    const q = render(<Harness initial="" />)
    const field = urlField(q)
    fireEvent.change(field, { target: { value: '   https://cdn.example.com/i.png' } })
    expect(field.value).toBe('https://cdn.example.com/i.png')
  })

  it('clears either kind of value', () => {
    const q = render(<Harness initial="https://cdn.example.com/i.png" />)
    fireEvent.click(q.getByLabelText('Remove icon'))
    expect(urlField(q).value).toBe('')
  })

  it('maps a validator key to its sentence, as every sibling field does', async () => {
    const q = render(
      <Harness
        initial=""
        validate={() => 'required'}
        errors={{ required: 'Enter an icon URL' }}
      />,
    )
    await act(async () => {
      fireEvent.submit(q.container.querySelector('form')!)
    })
    expect(q.getByText('Enter an icon URL')).toBeDefined()
  })

  it('falls back to the raw error when the map has no entry for it', async () => {
    const q = render(<Harness initial="" validate={() => 'Not a URL'} errors={{}} />)
    await act(async () => {
      fireEvent.submit(q.container.querySelector('form')!)
    })
    expect(q.getByText('Not a URL')).toBeDefined()
  })

  it('names the constraint a rejected drop actually failed', () => {
    const q = render(<Harness initial="" />)
    const input = q.getByLabelText(
      'Upload a bucket icon: PNG, JPEG, WebP or GIF',
    ) as HTMLInputElement
    // react-dropzone screens by type before onDrop, so a text file is rejected.
    const file = new File(['x'], 'notes.txt', { type: 'text/plain' })
    Object.defineProperty(input, 'files', { value: [file] })
    fireEvent.drop(input)
    expect(input.accept).toContain('image/png')
    expect(input.accept).not.toContain('image/svg+xml')
  })

  it('gives the file input an accessible name', () => {
    // The dropzone root is role="presentation" and the preview carries no text, so
    // without this the focusable target announces only its caption.
    const q = render(<Harness initial="" />)
    expect(q.getByLabelText('Upload a bucket icon: PNG, JPEG, WebP or GIF')).toBeDefined()
  })
})
