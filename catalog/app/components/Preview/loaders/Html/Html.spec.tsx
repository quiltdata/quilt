import * as React from 'react'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  captureException: vi.fn(),
  logError: vi.fn(),
  shouldSign: vi.fn(),
  sign: vi.fn(),
}))

vi.mock('@sentry/react', () => ({ captureException: mocks.captureException }))
vi.mock('constants/config', () => ({ default: {} }))
vi.mock('utils/AWS', () => ({
  Signer: { useS3Signer: () => mocks.sign },
}))
vi.mock('utils/AWS/useShouldSign', () => ({ default: () => mocks.shouldSign }))
vi.mock('utils/Logging', () => ({ default: { error: mocks.logError } }))

import type * as Model from 'model'
import AsyncResult from 'utils/AsyncResult'

import { PreviewData, PreviewError } from '../../types'

import { IFrameLoaderDirect } from './Html'

type DirectHandle = Model.S3.S3ObjectLocation & { size?: number }

const HANDLE: DirectHandle = {
  bucket: 'public-bucket',
  key: 'docs/index.html',
  version: 'version-1',
}

const OTHER_HANDLE: DirectHandle = {
  ...HANDLE,
  key: 'docs/other.html',
  version: 'version-2',
}

const HTML_RETYPE_MAX_SIZE = 3 * 1024 * 1024
const SANDBOX_BROWSABLE = 'allow-scripts allow-same-origin allow-forms allow-popups'
const SANDBOX_RESTRICTED = 'allow-scripts'

interface ErrorPayload {
  handle: DirectHandle
}

function Result({ result }: { result: unknown }) {
  return AsyncResult.case(
    {
      Init: () => <output data-testid="result" data-state="init" />,
      Pending: () => <output data-testid="result" data-state="pending" />,
      Ok: (data: ReturnType<typeof PreviewData.IFrame>) => {
        const iframe = PreviewData.IFrame.unbox(data)
        return (
          <output
            data-testid="result"
            data-state="ok"
            data-src={iframe.src}
            data-sandbox={iframe.sandbox}
          />
        )
      },
      Err: (error: unknown) =>
        PreviewError.case(
          {
            Forbidden: ({ handle }: ErrorPayload) => (
              <output
                data-testid="result"
                data-state="error"
                data-error="forbidden"
                data-handle-key={handle.key}
              />
            ),
            TooLarge: ({ handle }: ErrorPayload) => (
              <output
                data-testid="result"
                data-state="error"
                data-error="too-large"
                data-handle-key={handle.key}
              />
            ),
            DoesNotExist: ({ handle }: ErrorPayload) => (
              <output
                data-testid="result"
                data-state="error"
                data-error="does-not-exist"
                data-handle-key={handle.key}
              />
            ),
            Unexpected: ({
              message,
              retry,
            }: {
              message: React.ReactNode
              retry: () => void
            }) => (
              <div>
                <output data-testid="result" data-state="error" data-error="unexpected">
                  {message}
                </output>
                <button type="button" onClick={retry}>
                  Retry
                </button>
              </div>
            ),
            _: () => (
              <output data-testid="result" data-state="error" data-error="other" />
            ),
          },
          error,
        ),
    },
    result,
  )
}

function subject(handle: DirectHandle = HANDLE, browsable = false) {
  return (
    <IFrameLoaderDirect handle={handle} browsable={browsable}>
      {(result) => <Result result={result} />}
    </IFrameLoaderDirect>
  )
}

function response(contentType?: string, body = '<h1>Preview</h1>') {
  return new Response(body, {
    headers: contentType ? { 'Content-Type': contentType } : undefined,
  })
}

function withUrl(result: Response, url: string) {
  Object.defineProperty(result, 'url', { configurable: true, value: url })
  return result
}

function createdBlob() {
  const blob = vi.mocked(URL.createObjectURL).mock.calls[0]?.[0]
  expect(blob).toBeInstanceOf(Blob)
  if (!(blob instanceof Blob)) {
    throw new TypeError('Expected HTML preview to use a Blob URL')
  }
  return blob
}

function resultAttribute(
  element: HTMLElement,
  name: 'error' | 'src' | 'sandbox' | 'state',
) {
  return element.getAttribute(`data-${name}`)
}

describe('components/Preview/loaders/Html direct S3 preview', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mocks.captureException.mockReset()
    mocks.logError.mockReset()
    mocks.shouldSign.mockReset().mockReturnValue(false)
    mocks.sign
      .mockReset()
      .mockImplementation(
        ({ key, version }: Model.S3.S3ObjectLocation) =>
          `https://public-bucket.s3.amazonaws.com/${key}?versionId=${version}`,
      )

    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:html-preview')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('keeps the signed path and its HTML response override unchanged', () => {
    mocks.shouldSign.mockReturnValue(true)

    const { getByTestId } = render(subject())

    expect(resultAttribute(getByTestId('result'), 'state')).toBe('ok')
    expect(mocks.sign).toHaveBeenCalledWith(HANDLE, {
      ResponseContentType: 'text/html',
    })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('keeps a correctly typed unsigned response direct even above the retype cap', async () => {
    const largeHandle = { ...HANDLE, size: HTML_RETYPE_MAX_SIZE + 1 }
    fetchMock.mockResolvedValue(
      new Response('<h1>Preview</h1>', {
        headers: {
          'Content-Length': String(HTML_RETYPE_MAX_SIZE + 1),
          'Content-Type': 'TeXt/HtMl; charset=utf-8',
        },
      }),
    )

    const { getByTestId } = render(subject(largeHandle, true))

    await waitFor(() =>
      expect(resultAttribute(getByTestId('result'), 'state')).toBe('ok'),
    )
    expect(resultAttribute(getByTestId('result'), 'src')).toBe(mocks.sign(largeHandle))
    expect(resultAttribute(getByTestId('result'), 'sandbox')).toBe(SANDBOX_BROWSABLE)
    expect(fetchMock).toHaveBeenCalledWith(mocks.sign(largeHandle), {
      signal: expect.any(AbortSignal),
    })
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it.each([['application/octet-stream'], [undefined]])(
    'retypes an unsigned %s response and always restricts its Blob iframe',
    async (contentType) => {
      fetchMock.mockResolvedValue(response(contentType))

      const { getByTestId } = render(subject(HANDLE, true))

      await waitFor(() =>
        expect(resultAttribute(getByTestId('result'), 'state')).toBe('ok'),
      )
      expect(resultAttribute(getByTestId('result'), 'src')).toBe('blob:html-preview')
      expect(resultAttribute(getByTestId('result'), 'sandbox')).toBe(SANDBOX_RESTRICTED)
      expect(createdBlob().type).toBe('text/html')
    },
  )

  it('preserves relative subresources with the final response URL and keeps the document head', async () => {
    const finalUrl =
      'https://cdn.example.test/releases/docs/index.html?versionId=redirected-version'
    const documentSource =
      '<!doctype html><html><head data-note="1 > 0"><title>Preview</title></head><body><img src="./images/preview.png"></body></html>'
    fetchMock.mockResolvedValue(
      withUrl(response('application/octet-stream', documentSource), finalUrl),
    )

    const { getByTestId } = render(subject())
    await waitFor(() =>
      expect(resultAttribute(getByTestId('result'), 'state')).toBe('ok'),
    )

    const html = await createdBlob().text()
    expect(html.startsWith('<!doctype html>')).toBe(true)
    const parsed = new DOMParser().parseFromString(html, 'text/html')
    const base = parsed.head.querySelector('base')
    expect(parsed.doctype?.name).toBe('html')
    expect(parsed.head.firstElementChild).toBe(base)
    expect(parsed.head.querySelector('title')?.textContent).toBe('Preview')
    expect(base?.getAttribute('href')).toBe(finalUrl)
    expect(
      new URL(
        parsed.querySelector('img')?.getAttribute('src') ?? '',
        base?.getAttribute('href') ?? '',
      ).href,
    ).toBe('https://cdn.example.test/releases/docs/images/preview.png')
  })

  it('escapes attribute-sensitive characters in the version-preserving source URL', async () => {
    const sensitiveUrl =
      'https://public-bucket.s3.amazonaws.com/docs/index.html?versionId=v1&part=one"two\'<three>'
    mocks.sign.mockReturnValue(sensitiveUrl)
    fetchMock.mockResolvedValue(
      response(
        'application/octet-stream',
        '<!DOCTYPE html><html><head data-note="a > b"><title>Preview</title></head><body></body></html>',
      ),
    )

    const { getByTestId } = render(subject())
    await waitFor(() =>
      expect(resultAttribute(getByTestId('result'), 'state')).toBe('ok'),
    )

    const html = await createdBlob().text()
    expect(html).toContain(
      '<head data-note="a > b"><base href="https://public-bucket.s3.amazonaws.com/docs/index.html?versionId=v1&amp;part=one&quot;two&#39;&lt;three&gt;">',
    )
    const parsed = new DOMParser().parseFromString(html, 'text/html')
    expect(parsed.head.querySelector('base')?.getAttribute('href')).toBe(sensitiveUrl)
  })

  it('rejects a declared mistyped body above the retype cap before reading it', async () => {
    const oversized = new Response('not read', {
      headers: {
        'Content-Length': String(HTML_RETYPE_MAX_SIZE + 1),
        'Content-Type': 'application/octet-stream',
      },
    })
    const cancel = vi.spyOn(oversized.body!, 'cancel')
    fetchMock.mockResolvedValue(oversized)

    const { getByTestId } = render(subject())
    await waitFor(() =>
      expect(resultAttribute(getByTestId('result'), 'error')).toBe('too-large'),
    )

    expect(getByTestId('result').getAttribute('data-handle-key')).toBe(HANDLE.key)
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(mocks.logError).not.toHaveBeenCalled()
    expect(mocks.captureException).not.toHaveBeenCalled()
  })

  it('rejects a mistyped body when trusted handle size exceeds the retype cap', async () => {
    const oversizedHandle = { ...HANDLE, size: HTML_RETYPE_MAX_SIZE + 1 }
    const result = response('application/octet-stream')
    const cancel = vi.spyOn(result.body!, 'cancel')
    fetchMock.mockResolvedValue(result)

    const { getByTestId } = render(subject(oversizedHandle))
    await waitFor(() =>
      expect(resultAttribute(getByTestId('result'), 'error')).toBe('too-large'),
    )

    expect(getByTestId('result').getAttribute('data-handle-key')).toBe(HANDLE.key)
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('cancels a mistyped stream when its bytes overflow the retype cap', async () => {
    const cancel = vi.fn()
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(HTML_RETYPE_MAX_SIZE))
        controller.enqueue(new Uint8Array([1]))
      },
      cancel,
    })
    fetchMock.mockResolvedValue(
      new Response(stream, { headers: { 'Content-Type': 'application/octet-stream' } }),
    )

    const { getByTestId } = render(subject())
    await waitFor(() =>
      expect(resultAttribute(getByTestId('result'), 'error')).toBe('too-large'),
    )

    expect(cancel).toHaveBeenCalledTimes(1)
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(mocks.logError).not.toHaveBeenCalled()
    expect(mocks.captureException).not.toHaveBeenCalled()
  })

  it('aborts and revokes its Blob URL on unmount', async () => {
    fetchMock.mockResolvedValue(response('binary/octet-stream'))

    const { getByTestId, unmount } = render(subject())
    await waitFor(() =>
      expect(resultAttribute(getByTestId('result'), 'state')).toBe('ok'),
    )
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal
    expect(signal.aborted).toBe(false)

    unmount()

    expect(signal.aborted).toBe(true)
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:html-preview')
  })

  it('cancels and ignores a body that arrives after a handle change', async () => {
    let resolveBody: (
      result: ReadableStreamReadResult<Uint8Array<ArrayBuffer>>,
    ) => void = () => {}
    const first = response('application/octet-stream')
    const reader = {
      cancel: vi.fn().mockResolvedValue(undefined),
      read: vi.fn().mockReturnValue(
        new Promise<ReadableStreamReadResult<Uint8Array<ArrayBuffer>>>((resolve) => {
          resolveBody = resolve
        }),
      ),
      releaseLock: vi.fn(),
    } as unknown as ReadableStreamDefaultReader<Uint8Array<ArrayBuffer>>
    vi.spyOn(first.body!, 'getReader').mockReturnValue(reader)
    fetchMock.mockResolvedValueOnce(first).mockResolvedValueOnce(response('text/html'))

    const { getByTestId, rerender } = render(subject())
    await waitFor(() => expect(reader.read).toHaveBeenCalledTimes(1))
    const firstSignal = fetchMock.mock.calls[0][1].signal as AbortSignal

    rerender(subject(OTHER_HANDLE))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(firstSignal.aborted).toBe(true)
    expect(reader.cancel).toHaveBeenCalled()

    await act(async () => {
      resolveBody({ done: false, value: new Uint8Array([1]) })
    })

    await waitFor(() =>
      expect(resultAttribute(getByTestId('result'), 'src')).toBe(
        mocks.sign(OTHER_HANDLE),
      ),
    )
    expect(reader.releaseLock).toHaveBeenCalledTimes(1)
    expect(URL.createObjectURL).not.toHaveBeenCalled()
    expect(mocks.logError).not.toHaveBeenCalled()
    expect(mocks.captureException).not.toHaveBeenCalled()
  })

  it.each([
    [401, 'forbidden'],
    [403, 'forbidden'],
    [404, 'does-not-exist'],
  ])('maps HTTP %i to the stable %s Preview error', async (status, variant) => {
    fetchMock.mockResolvedValue(new Response('', { status }))

    const { getByTestId, queryByText } = render(subject())
    await waitFor(() =>
      expect(resultAttribute(getByTestId('result'), 'error')).toBe(variant),
    )

    expect(getByTestId('result').getAttribute('data-handle-key')).toBe(HANDLE.key)
    expect(queryByText('Retry')).toBeNull()
    expect(mocks.logError).not.toHaveBeenCalled()
    expect(mocks.captureException).not.toHaveBeenCalled()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('surfaces a non-OK response and retries through the Preview error', async () => {
    let resolveRetry: (response: Response) => void = () => {}
    fetchMock
      .mockResolvedValueOnce(
        new Response('', { status: 503, statusText: 'Service Unavailable' }),
      )
      .mockReturnValueOnce(
        new Promise<Response>((resolve) => {
          resolveRetry = resolve
        }),
      )

    const { getByTestId, getByText } = render(subject())
    await waitFor(() =>
      expect(resultAttribute(getByTestId('result'), 'state')).toBe('error'),
    )
    expect(resultAttribute(getByTestId('result'), 'error')).toBe('unexpected')
    expect(getByTestId('result').textContent).toContain('503 Service Unavailable')
    expect(mocks.logError).toHaveBeenCalledTimes(1)
    expect(mocks.captureException).toHaveBeenCalledTimes(1)

    fireEvent.click(getByText('Retry'))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(resultAttribute(getByTestId('result'), 'state')).toBe('pending')

    await act(async () => {
      resolveRetry(response('text/html'))
    })
    await waitFor(() =>
      expect(resultAttribute(getByTestId('result'), 'state')).toBe('ok'),
    )
  })

  it('surfaces a body-read failure through the same retryable error', async () => {
    const unreadable = response('application/octet-stream')
    const reader = {
      cancel: vi.fn().mockResolvedValue(undefined),
      read: vi.fn().mockRejectedValue(new Error('body interrupted')),
      releaseLock: vi.fn(),
    } as unknown as ReadableStreamDefaultReader<Uint8Array<ArrayBuffer>>
    vi.spyOn(unreadable.body!, 'getReader').mockReturnValue(reader)
    fetchMock.mockResolvedValue(unreadable)

    const { getByTestId, getByText } = render(subject())

    await waitFor(() =>
      expect(resultAttribute(getByTestId('result'), 'state')).toBe('error'),
    )
    expect(getByTestId('result').textContent).toContain('body interrupted')
    expect(getByText('Retry')).toBeTruthy()
    expect(mocks.captureException).toHaveBeenCalledTimes(1)
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('preserves direct navigation when CORS prevents inspecting the response', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))

    const { getByTestId } = render(subject(HANDLE, true))

    await waitFor(() =>
      expect(resultAttribute(getByTestId('result'), 'state')).toBe('ok'),
    )
    expect(resultAttribute(getByTestId('result'), 'src')).toBe(mocks.sign(HANDLE))
    expect(resultAttribute(getByTestId('result'), 'sandbox')).toBe(SANDBOX_BROWSABLE)
    expect(mocks.logError).not.toHaveBeenCalled()
    expect(mocks.captureException).not.toHaveBeenCalled()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })
})
