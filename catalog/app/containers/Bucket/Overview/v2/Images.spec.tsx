import * as React from 'react'
import { MemoryRouter } from 'react-router-dom'
import { render, cleanup, fireEvent, within } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'

import * as NamedRoutes from 'utils/NamedRoutes'
import AsyncResult from 'utils/AsyncResult'
import * as BucketPreferences from 'utils/BucketPreferences'

import Images from './Images'

const config = vi.hoisted(() => ({ noOverviewImages: false }))
vi.mock('constants/config', () => ({ default: config }))

vi.mock('utils/AWS', () => ({
  S3: { use: () => ({}) },
}))

vi.mock('utils/APIConnector', () => ({
  use: () => vi.fn(),
}))

// `inStack` is derived from this query in the real component.
vi.mock('utils/GraphQL', () => ({
  useQueryS: () => ({ bucket: { name: 'test-bucket' } }),
}))

// Stub the actual image loading so the test never hits S3 / the thumbnail
// lambda; render a recognizable element instead.
vi.mock('components/Thumbnail', () => ({
  default: ({ alt, size }: { alt?: string; size?: string }) => (
    <div data-testid="thumbnail" data-size={size ?? 'sm'}>
      {alt}
    </div>
  ),
}))

const useDataResult = vi.hoisted(() => vi.fn())
vi.mock('utils/Data', () => ({
  useData: () => ({ result: useDataResult() }),
}))

const galleryPrefs = vi.hoisted(() =>
  vi.fn<() => false | { overview: boolean }>(() => ({ overview: true })),
)
vi.mock('utils/BucketPreferences', async () => {
  const actual = await vi.importActual<typeof BucketPreferences>(
    'utils/BucketPreferences',
  )
  return {
    ...actual,
    use: () => ({
      prefs: actual.Result.Ok({
        ui: { blocks: { gallery: galleryPrefs() } },
      } as unknown as Parameters<typeof actual.Result.Ok>[0]),
    }),
  }
})

const routes = {
  bucketFile: {
    path: '',
    url: (bucket: string, key: string) => `/b/${bucket}/tree/${key}`,
  },
}

function renderImages(bucket = 'test-bucket') {
  return render(
    <MemoryRouter>
      <NamedRoutes.Provider routes={routes}>
        <Images bucket={bucket} />
      </NamedRoutes.Provider>
    </MemoryRouter>,
  )
}

const THREE_IMAGES = [
  { bucket: 'test-bucket', key: 'a.png' },
  { bucket: 'test-bucket', key: 'b.jpg' },
  { bucket: 'test-bucket', key: 'c.gif' },
]

describe('containers/Bucket/Overview/v2/Images', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    config.noOverviewImages = false
    galleryPrefs.mockReturnValue({ overview: true })
  })

  it('renders nothing while loading', () => {
    useDataResult.mockReturnValue(AsyncResult.Pending())
    const { container } = renderImages()
    expect(container.querySelectorAll('[data-testid="thumbnail"]')).toHaveLength(0)
  })

  it('renders nothing when there are no images', () => {
    useDataResult.mockReturnValue(AsyncResult.Ok([]))
    const { container } = renderImages()
    expect(container.textContent).toBe('')
  })

  it('renders nothing when gallery.overview is false', () => {
    galleryPrefs.mockReturnValue({ overview: false })
    useDataResult.mockReturnValue(AsyncResult.Ok(THREE_IMAGES))
    const { container } = renderImages()
    expect(container.textContent).toBe('')
  })

  it('renders nothing when the gallery block is disabled', () => {
    galleryPrefs.mockReturnValue(false)
    useDataResult.mockReturnValue(AsyncResult.Ok(THREE_IMAGES))
    const { container } = renderImages()
    expect(container.textContent).toBe('')
  })

  it('renders nothing when cfg.noOverviewImages is set', () => {
    config.noOverviewImages = true
    useDataResult.mockReturnValue(AsyncResult.Ok(THREE_IMAGES))
    const { container } = renderImages()
    expect(container.textContent).toBe('')
  })

  it('renders a compact thumbnail per image', () => {
    useDataResult.mockReturnValue(AsyncResult.Ok(THREE_IMAGES))
    const { getAllByTestId } = renderImages()
    expect(getAllByTestId('thumbnail')).toHaveLength(THREE_IMAGES.length)
  })

  // The open carousel layers an `sm` placeholder under the full `lg` render,
  // so it contains two thumbnails for the current image; the `lg` one is the
  // full image and the `sm` one is the instant preview.
  const carouselThumb = (dialog: HTMLElement, size: 'sm' | 'lg') =>
    within(dialog)
      .getAllByTestId('thumbnail')
      .find((el) => el.getAttribute('data-size') === size)

  it('opens a carousel showing the selected image when a thumbnail is clicked', () => {
    useDataResult.mockReturnValue(AsyncResult.Ok(THREE_IMAGES))
    const { getAllByTestId, getByRole } = renderImages()
    fireEvent.click(getAllByTestId('thumbnail')[1])
    const dialog = getByRole('dialog')
    expect(dialog).toBeTruthy()
    // The selected (second) image is shown at full/large size in the carousel,
    // with an `sm` placeholder layered underneath.
    const large = carouselThumb(dialog, 'lg')
    expect(large?.textContent).toBe('b.jpg')
    const preview = carouselThumb(dialog, 'sm')
    expect(preview?.textContent).toBe('b.jpg')
  })

  it('navigates between images with prev/next controls', () => {
    useDataResult.mockReturnValue(AsyncResult.Ok(THREE_IMAGES))
    const { getAllByTestId, getByRole, getByLabelText } = renderImages()
    fireEvent.click(getAllByTestId('thumbnail')[0])
    const dialog = getByRole('dialog')
    expect(carouselThumb(dialog, 'lg')?.textContent).toBe('a.png')

    fireEvent.click(getByLabelText(/next/i))
    expect(carouselThumb(dialog, 'lg')?.textContent).toBe('b.jpg')

    fireEvent.click(getByLabelText(/previous/i))
    expect(carouselThumb(dialog, 'lg')?.textContent).toBe('a.png')
  })

  it('navigates between images with arrow keys (with wrap)', () => {
    useDataResult.mockReturnValue(AsyncResult.Ok(THREE_IMAGES))
    const { getAllByTestId, getByRole } = renderImages()
    fireEvent.click(getAllByTestId('thumbnail')[0])
    const dialog = getByRole('dialog')
    expect(carouselThumb(dialog, 'lg')?.textContent).toBe('a.png')

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(carouselThumb(dialog, 'lg')?.textContent).toBe('b.jpg')

    // Wrap from the first image to the last.
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(carouselThumb(dialog, 'lg')?.textContent).toBe('a.png')
    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(carouselThumb(dialog, 'lg')?.textContent).toBe('c.gif')
  })
})
