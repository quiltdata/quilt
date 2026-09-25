import * as React from 'react'
import { render } from '@testing-library/react'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

const { dataUse, fetchMock, memoEq, pending, sign, useErrorHandling, warnSpy, errorSpy } =
  vi.hoisted(() => ({
    dataUse: vi.fn(),
    fetchMock: vi.fn(),
    memoEq: vi.fn(),
    pending: [] as Promise<unknown>[],
    sign: vi.fn(),
    useErrorHandling: vi.fn((value: unknown, options: unknown) => ({ value, options })),
    warnSpy: vi.spyOn(console, 'warn').mockImplementation(() => {}),
    errorSpy: vi.spyOn(console, 'error').mockImplementation(() => {}),
  }))

vi.mock('constants/config', () => ({
  default: { apiGatewayEndpoint: 'https://api.example.com' },
}))
vi.mock('utils/APIConnector', () => ({
  HTTPError: class HTTPError extends Error {
    response: Response

    json: any

    constructor(response: Response, text: string) {
      super(text)
      this.response = response
      try {
        this.json = JSON.parse(text)
      } catch {
        this.json = null
      }
    }
  },
}))
vi.mock('utils/AWS', () => ({
  Signer: { useS3Signer: () => sign },
}))
vi.mock('utils/Data', () => ({ use: dataUse }))
vi.mock('utils/NamedRoutes', () => ({
  mkSearch: (params: Record<string, unknown>) =>
    `?${Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
      .join('&')}`,
}))
vi.mock('utils/useMemoEq', () => ({
  default: memoEq,
}))
vi.mock('../types', () => ({
  PreviewData: {
    Pdf: (value: unknown) => ({ tag: 'Pdf', value }),
  },
  PreviewError: {
    Archived: (value: unknown) => {
      const err: Error & { tag: string; value: unknown } = Object.assign(
        new Error('Archived'),
        { tag: 'Archived', value },
      )
      return err
    },
    Forbidden: (value: unknown) => {
      const err: Error & { tag: string; value: unknown } = Object.assign(
        new Error('Forbidden'),
        { tag: 'Forbidden', value },
      )
      return err
    },
  },
}))
vi.mock('./utils', () => ({
  GLACIER_ERROR_RE:
    /<Code>InvalidObjectState<\/Code><Message>The operation is not valid for the object's storage class<\/Message>/,
  extIn: (extensions: string[]) => (key: string) =>
    extensions.some((ext) => key.toLowerCase().endsWith(ext)),
  useErrorHandling,
}))

import { detect, Loader } from './Pdf'

describe('components/Preview/loaders/Pdf', () => {
  afterAll(() => {
    warnSpy.mockRestore()
    errorSpy.mockRestore()
  })

  describe('detect', () => {
    it('detects .pdf files', () => {
      expect(detect('report.pdf')).toBe(true)
      expect(detect('REPORT.PDF')).toBe(true)
    })

    it('detects .pptx files', () => {
      expect(detect('slides.pptx')).toBe(true)
      expect(detect('DECK.PPTX')).toBe(true)
    })

    it('rejects other extensions', () => {
      expect(detect('doc.docx')).toBe(false)
      expect(detect('image.png')).toBe(false)
      expect(detect('data.csv')).toBe(false)
    })

    it('rejects files without extensions', () => {
      expect(detect('README')).toBe(false)
    })
  })

  describe('loadPdf', () => {
    beforeEach(() => {
      pending.length = 0
      dataUse.mockReset()
      fetchMock.mockReset()
      memoEq.mockReset()
      sign.mockReset()
      useErrorHandling.mockClear()
      warnSpy.mockClear()
      errorSpy.mockClear()
      memoEq.mockImplementation((_deps: unknown[], fn: () => unknown) => fn())
      dataUse.mockImplementation(
        (fn: (value: unknown) => Promise<unknown>, value: unknown) => {
          pending.push(fn(value))
          return { result: { tag: 'Loading' }, fetch: 'retry-fetch' }
        },
      )
      sign.mockReturnValue('https://signed-url.example.com/doc.pdf')
      vi.stubGlobal('fetch', fetchMock)
    })

    it('fetches thumbnail with correct parameters for pdf', async () => {
      const blob = new Blob(['fake-pdf'], { type: 'application/pdf' })
      const headers = new Headers({ 'X-Quilt-Info': JSON.stringify({ page_count: 3 }) })
      fetchMock.mockResolvedValue(new Response(blob, { status: 200, headers }))

      const handle = { bucket: 'demo', key: 'report.pdf', version: '123' }
      const handled = {
        value: { tag: 'Handled' },
        options: { handle, retry: 'retry-fetch' },
      }
      const children = vi.fn(() => null)
      useErrorHandling.mockReturnValueOnce(handled)
      render(
        React.createElement(Loader, {
          handle: handle as never,
          children: children as never,
        }),
      )

      expect(memoEq).toHaveBeenCalledWith(
        [sign, handle.bucket, handle.key, handle.version],
        expect.any(Function),
      )
      expect(sign).toHaveBeenCalledWith(handle)
      expect(dataUse).toHaveBeenCalledWith(expect.any(Function), {
        url: 'https://signed-url.example.com/doc.pdf',
        handle,
      })
      expect(useErrorHandling).toHaveBeenCalledWith(
        { tag: 'Loading' },
        { handle, retry: 'retry-fetch' },
      )
      expect(children).toHaveBeenCalledWith(handled)

      await expect(pending[0]).resolves.toMatchObject({
        tag: 'Pdf',
        value: expect.objectContaining({
          handle,
          pages: 3,
          type: 'pdf',
        }),
      })
      expect(fetchMock).toHaveBeenCalledTimes(1)
      const requestUrl = new URL(fetchMock.mock.calls[0][0])
      expect(requestUrl.pathname).toBe('/thumbnail')
      expect(requestUrl.searchParams.get('url')).toBe(
        'https://signed-url.example.com/doc.pdf',
      )
      expect(requestUrl.searchParams.get('input')).toBe('pdf')
      expect(requestUrl.searchParams.get('size')).toBe('w2048h1536')
      expect(requestUrl.searchParams.get('countPages')).toBe('true')
      expect(Array.from(requestUrl.searchParams.keys()).sort()).toEqual([
        'countPages',
        'input',
        'size',
        'url',
      ])
    })

    it('loads pptx previews based on the logical key extension', async () => {
      fetchMock.mockResolvedValue(
        new Response(new Blob(['fake-pptx'], { type: 'application/pdf' }), {
          status: 200,
          headers: new Headers({ 'X-Quilt-Info': JSON.stringify({ page_count: 7 }) }),
        }),
      )

      render(
        React.createElement(Loader, {
          handle: {
            bucket: 'demo',
            key: 'hashed/asset',
            logicalKey: 'slides.pptx',
          } as never,
          children: () => null,
        }),
      )

      await expect(pending[0]).resolves.toEqual(
        expect.objectContaining({
          tag: 'Pdf',
          value: expect.objectContaining({ type: 'pptx', pages: 7 }),
        }),
      )
      expect(fetchMock).toHaveBeenCalledTimes(1)
      const requestUrl = new URL(fetchMock.mock.calls[0][0])
      expect(requestUrl.searchParams.get('input')).toBe('pptx')
    })

    it('maps forbidden glacier responses to Archived PreviewError', async () => {
      fetchMock.mockResolvedValue(
        new Response(
          JSON.stringify({
            error: 'Forbidden',
            text: "<Error><Code>InvalidObjectState</Code><Message>The operation is not valid for the object's storage class</Message></Error>",
          }),
          { status: 403 },
        ),
      )

      render(
        React.createElement(Loader, {
          handle: { bucket: 'demo', key: 'report.pdf' } as never,
          children: () => null,
        }),
      )

      await expect(pending[0]).rejects.toMatchObject({ tag: 'Archived' })
    })

    it('maps non-glacier forbidden responses to Forbidden PreviewError', async () => {
      fetchMock.mockResolvedValue(
        new Response(
          JSON.stringify({
            error: 'Forbidden',
            text: 'Access denied',
          }),
          { status: 403 },
        ),
      )

      render(
        React.createElement(Loader, {
          handle: { bucket: 'demo', key: 'report.pdf' } as never,
          children: () => null,
        }),
      )

      await expect(pending[0]).rejects.toMatchObject({ tag: 'Forbidden' })
    })

    it('rethrows unexpected errors so retry handling can wrap them later', async () => {
      fetchMock.mockRejectedValue(new Error('boom'))

      render(
        React.createElement(Loader, {
          handle: { bucket: 'demo', key: 'report.pdf' } as never,
          children: () => null,
        }),
      )

      await expect(pending[0]).rejects.toThrow('boom')
      expect(warnSpy).toHaveBeenCalledTimes(1)
      expect(warnSpy).toHaveBeenCalledWith(
        'error loading pdf preview',
        expect.any(Object),
      )
      expect(errorSpy).toHaveBeenCalledTimes(1)
      expect((errorSpy.mock.calls[0][0] as Error).message).toBe('boom')
    })
  })
})
