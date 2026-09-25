import * as React from 'react'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import * as RF from 'react-final-form'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('constants/config', () => ({ default: {} }))

// The cropper needs layout and a canvas, neither of which jsdom has; the crop
// itself is covered by iconCrop.spec.ts and the browser harness. The stub reports
// a crop area on mount, which is what enables the dialog's confirm button.
const CROP_AREA = { x: 0, y: 0, width: 200, height: 200 }
vi.mock('react-easy-crop', () => {
  // Named, because the hook below is only legal inside a component the linter can
  // recognise as one.
  function CropperStub({
    onCropComplete,
  }: {
    onCropComplete: (a: unknown, b: unknown) => void
  }) {
    React.useEffect(() => {
      onCropComplete(CROP_AREA, CROP_AREA)
    }, [onCropComplete])
    return <div data-testid="cropper" />
  }
  return { default: CropperStub }
})

vi.mock('components/BucketIcon', () => ({
  default: ({ src, tintKey }: { src: string | null; tintKey: string }) => (
    <div data-testid="preview" data-src={src ?? ''} data-tint={tintKey} />
  ),
}))

// The canvas work is covered by iconCrop.spec.ts and the browser harness; here it
// is stubbed so the dialog's own wiring can be exercised in jsdom, which has no
// canvas and would fail every encode.
const cropToDataUrl = vi.fn<(src: string, area: unknown) => Promise<string>>()
const probeWithinPixelBudget = vi.fn<(src: string) => Promise<boolean>>()
vi.mock('./iconCrop', () => ({
  // The real bound: mocking it smaller would make the paste cap agree with the
  // mock rather than with what the crop path actually stores.
  MAX_ICON_DATA_URL_LENGTH: 16 * 1024,
  cropToDataUrl: (src: string, area: unknown) => cropToDataUrl(src, area),
  probeWithinPixelBudget: (src: string) => probeWithinPixelBudget(src),
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
  beforeEach(() => {
    cropToDataUrl.mockReset()
    probeWithinPixelBudget.mockReset()
    probeWithinPixelBudget.mockResolvedValue(true)
  })
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
    // A space inside the value survives; trimming per keystroke makes it untypable.
    expect(field.value).toBe('https://cdn.example.com/my icon.png')
    fireEvent.change(field, { target: { value: 'https://cdn.example.com/i.png  ' } })
    fireEvent.blur(field)
    expect(field.value).toBe('https://cdn.example.com/i.png')
  })

  it('strips leading whitespace from a pasted URL', () => {
    const q = render(<Harness initial="" />)
    const field = urlField(q)
    fireEvent.change(field, { target: { value: '   https://cdn.example.com/i.png' } })
    expect(field.value).toBe('https://cdn.example.com/i.png')
  })

  it('keeps a pasted data: URI whole rather than cutting it at the URL cap', () => {
    // Cut to 1024 the value still reads as uploaded, so the field locks read-only
    // over a truncated URI the admin can no longer repair by typing.
    const uri = `data:image/png;base64,${'A'.repeat(4000)}`
    const q = render(<Harness initial="" />)
    fireEvent.change(urlField(q), { target: { value: uri } })
    expect(q.getByTestId('preview').dataset.src).toBe(uri)
  })

  it('reads the data: scheme case-insensitively, as BucketIcon does', () => {
    // BucketIcon decides from the scheme case-insensitively, so a `DATA:` value it
    // would draw as an image must not be cut to the URL length here.
    const uri = `DATA:image/png;base64,${'A'.repeat(20 * 1024)}`
    const q = render(<Harness initial="" />)
    fireEvent.change(urlField(q), { target: { value: uri } })
    expect(q.getByText('That image data is too long to store as an icon')).toBeDefined()
    expect(q.getByTestId('preview').dataset.src).toBe('')
  })

  it('refuses a data: URI past the stored bound instead of truncating it', () => {
    // Any cut yields a value that cannot decode but still reads as uploaded, so an
    // over-long paste is refused outright rather than stored in part.
    const uri = `data:image/png;base64,${'A'.repeat(20 * 1024)}`
    const q = render(<Harness initial="" />)
    fireEvent.change(urlField(q), { target: { value: uri } })
    expect(q.getByText('That image data is too long to store as an icon')).toBeDefined()
    expect(q.getByTestId('preview').dataset.src).toBe('')
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

  // Each rejection names the constraint that actually failed: told "wrong format"
  // after dropping two correctly-typed files, an admin cannot find the real one.
  it.each([
    [
      'the wrong format',
      [new File(['x'], 'notes.txt', { type: 'text/plain' })],
      'Choose a PNG, JPEG, WebP or GIF image',
    ],
    [
      'more than one file',
      [
        new File(['x'], 'a.png', { type: 'image/png' }),
        new File(['x'], 'b.png', { type: 'image/png' }),
      ],
      'Choose one image',
    ],
  ])('reports %s by its own constraint', async (_label, files, message) => {
    const q = render(<Harness initial="" />)
    const input = q.getByLabelText(
      'Upload a bucket icon: PNG, JPEG, WebP or GIF',
    ) as HTMLInputElement
    Object.defineProperty(input, 'files', { value: files, configurable: true })
    await act(async () => {
      fireEvent.drop(input)
    })
    expect(q.getByText(message)).toBeDefined()
    expect(q.queryByText('Crop icon')).toBeNull()
  })

  it('refuses a file over the source byte cap by its size, not its type', async () => {
    const q = render(<Harness initial="" />)
    const input = q.getByLabelText(
      'Upload a bucket icon: PNG, JPEG, WebP or GIF',
    ) as HTMLInputElement
    const big = new File(['x'], 'huge.png', { type: 'image/png' })
    Object.defineProperty(big, 'size', { value: 13 * 1024 * 1024 })
    Object.defineProperty(input, 'files', { value: [big], configurable: true })
    await act(async () => {
      fireEvent.drop(input)
    })
    expect(q.getByText('Choose an image under 12MB')).toBeDefined()
  })

  it('retires a probe still running when a later drop is rejected', async () => {
    // Otherwise the slow pick's dialog opens over the rejection naming another file,
    // leaving no way to tell which image is being cropped.
    let settle: (v: boolean) => void = () => {}
    probeWithinPixelBudget.mockReturnValueOnce(
      new Promise<boolean>((res) => {
        settle = res
      }),
    )
    const q = render(<Harness initial="" />)
    const input = q.getByLabelText(
      'Upload a bucket icon: PNG, JPEG, WebP or GIF',
    ) as HTMLInputElement
    const good = new File(['x'], 'slow.png', { type: 'image/png' })
    Object.defineProperty(input, 'files', { value: [good], configurable: true })
    fireEvent.drop(input)

    const bad = new File(['x'], 'notes.txt', { type: 'text/plain' })
    Object.defineProperty(input, 'files', { value: [bad], configurable: true })
    await act(async () => {
      fireEvent.drop(input)
    })
    await act(async () => {
      settle(true)
    })
    expect(q.getByText('Choose a PNG, JPEG, WebP or GIF image')).toBeDefined()
    expect(q.queryByText('Crop icon')).toBeNull()
  })

  it('gives the file input an accessible name', () => {
    // The dropzone root is role="presentation" and the preview carries no text, so
    // without this the focusable target announces only its caption.
    const q = render(<Harness initial="" />)
    expect(q.getByLabelText('Upload a bucket icon: PNG, JPEG, WebP or GIF')).toBeDefined()
  })

  describe('the crop dialog', () => {
    const png = (name = 'logo.png') => new File(['binary'], name, { type: 'image/png' })

    async function drop(q: ReturnType<typeof render>, file: File) {
      const input = q.getByLabelText(
        'Upload a bucket icon: PNG, JPEG, WebP or GIF',
      ) as HTMLInputElement
      Object.defineProperty(input, 'files', { value: [file], configurable: true })
      await act(async () => {
        fireEvent.drop(input)
      })
    }

    it('opens on an accepted drop, once the pixel screen passes', async () => {
      probeWithinPixelBudget.mockResolvedValue(true)
      const q = render(<Harness initial="" />)
      await drop(q, png())
      expect(q.getByText('Crop icon')).toBeDefined()
    })

    it('stays shut and names the constraint when the screen refuses', async () => {
      probeWithinPixelBudget.mockResolvedValue(false)
      const q = render(<Harness initial="" />)
      await drop(q, png())
      expect(q.queryByText('Crop icon')).toBeNull()
      expect(q.getByText('Choose an image with fewer pixels')).toBeDefined()
    })

    it('reports a source it cannot read at all', async () => {
      probeWithinPixelBudget.mockRejectedValue(new Error('decode failed'))
      const q = render(<Harness initial="" />)
      await drop(q, png())
      expect(q.getByText('Could not read that image')).toBeDefined()
    })

    it('forwards the encoded crop to the field', async () => {
      probeWithinPixelBudget.mockResolvedValue(true)
      cropToDataUrl.mockResolvedValue('data:image/png;base64,ENCODED')
      const q = render(<Harness initial="" />)
      await drop(q, png())
      await act(async () => {
        fireEvent.click(q.getByText('Use icon'))
      })
      expect(cropToDataUrl).toHaveBeenCalledWith(expect.any(String), CROP_AREA)
      expect(q.getByTestId('preview').dataset.src).toBe('data:image/png;base64,ENCODED')
      expect(q.queryByText('Crop icon')).toBeNull()
    })

    it('leaves the field alone on cancel', async () => {
      probeWithinPixelBudget.mockResolvedValue(true)
      const q = render(<Harness initial="https://cdn.example.com/i.png" />)
      await drop(q, png())
      await act(async () => {
        fireEvent.click(q.getByText('Cancel'))
      })
      expect(cropToDataUrl).not.toHaveBeenCalled()
      expect(urlField(q).value).toBe('https://cdn.example.com/i.png')
      expect(q.queryByText('Crop icon')).toBeNull()
    })

    it('keeps a failed encode readable after the dialog closes', async () => {
      // The refusal is the admin's cue to pick another image, so it has to outlive
      // the dialog that reported it rather than vanishing with it.
      probeWithinPixelBudget.mockResolvedValue(true)
      cropToDataUrl.mockRejectedValue(new Error('This image is too detailed'))
      const q = render(<Harness initial="" />)
      await drop(q, png())
      await act(async () => {
        fireEvent.click(q.getByText('Use icon'))
      })
      // Reported in the dialog first, and retained once it is dismissed.
      expect(q.getByText('This image is too detailed')).toBeDefined()
      await act(async () => {
        fireEvent.click(q.getByText('Cancel'))
      })
      expect(q.queryByText('Crop icon')).toBeNull()
      expect(q.getByText('This image is too detailed')).toBeDefined()
    })

    it('warns that only a GIF first frame survives', async () => {
      probeWithinPixelBudget.mockResolvedValue(true)
      const q = render(<Harness initial="" />)
      await drop(q, new File(['x'], 'anim.gif', { type: 'image/gif' }))
      expect(q.getByText(/only this GIF's first frame is kept/)).toBeDefined()
    })

    it('says nothing about frames for a still image', async () => {
      probeWithinPixelBudget.mockResolvedValue(true)
      const q = render(<Harness initial="" />)
      await drop(q, png())
      expect(q.queryByText(/first frame/)).toBeNull()
    })
  })
})
