import * as React from 'react'
import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  dataUse,
  fetchMock,
  pending,
  retryFetch,
  sign,
  useErrorHandling,
  warnSpy,
  errorSpy,
} = vi.hoisted(() => ({
  dataUse: vi.fn(),
  fetchMock: vi.fn(),
  pending: [] as Promise<unknown>[],
  retryFetch: vi.fn(),
  sign: vi.fn(),
  useErrorHandling: vi.fn((value: unknown) => value),
  warnSpy: vi.spyOn(console, 'warn').mockImplementation(() => {}),
  errorSpy: vi.spyOn(console, 'error').mockImplementation(() => {}),
}))

vi.mock('constants/config', () => ({
  default: { apiGatewayEndpoint: 'https://api.example.com' },
}))

vi.mock('utils/APIConnector', () => ({
  HTTPError: class HTTPError extends Error {
    json: any

    constructor(_response: Response, text: string) {
      super(text)
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

vi.mock('../types', () => ({
  PreviewData: {
    Pdf: (value: unknown) => ({ tag: 'Pdf', value }),
  },
  PreviewError: {
    Archived: (value: unknown) =>
      Object.assign(new Error('Archived'), { tag: 'Archived', value }),
    Forbidden: (value: unknown) =>
      Object.assign(new Error('Forbidden'), { tag: 'Forbidden', value }),
  },
}))

vi.mock('./utils', () => ({
  GLACIER_ERROR_RE: /storage class/i,
  extIn: (extensions: string[]) => (key: string) =>
    extensions.some((ext) => key.toLowerCase().endsWith(ext)),
  useErrorHandling,
}))

import { detect, Loader } from './Pdf'

describe('components/Preview/loaders/Pdf', () => {
  beforeEach(() => {
    pending.length = 0
    dataUse.mockReset()
    fetchMock.mockReset()
    sign.mockReset()
    retryFetch.mockReset()
    useErrorHandling.mockClear()
    warnSpy.mockClear()
    errorSpy.mockClear()

    sign.mockReturnValue('https://signed-url.example.com/file')
    dataUse.mockImplementation(
      (fn: (value: unknown) => Promise<unknown>, value: unknown) => {
        pending.push(fn(value))
        return { result: { tag: 'Loading' }, fetch: retryFetch }
      },
    )

    vi.stubGlobal('fetch', fetchMock)
  })

  describe('detect', () => {
    it('accepts .pdf and .pptx keys case-insensitively', () => {
      expect(detect('report.pdf')).toBe(true)
      expect(detect('REPORT.PDF')).toBe(true)
      expect(detect('slides.pptx')).toBe(true)
      expect(detect('SLIDES.PPTX')).toBe(true)
    })

    it('rejects non-matching keys', () => {
      expect(detect('report.pdf.txt')).toBe(false)
      expect(detect('slides.ppt')).toBe(false)
      expect(detect('README')).toBe(false)
    })
  })

  it('loads pdf thumbnail with exact request contract and wraps result', async () => {
    const handle = { bucket: 'demo', key: 'report.pdf' }
    const firstPageBlob = new Blob(['pdf'], { type: 'application/pdf' })
    fetchMock.mockResolvedValue(
      new Response(firstPageBlob, {
        status: 200,
        headers: new Headers({ 'X-Quilt-Info': JSON.stringify({ page_count: 3 }) }),
      }),
    )

    render(React.createElement(Loader, { handle: handle as never, children: () => null }))

    expect(pending).toHaveLength(1)
    expect(sign).toHaveBeenCalledTimes(1)
    expect(sign).toHaveBeenCalledWith(handle)
    expect(dataUse).toHaveBeenCalledTimes(1)
    expect(dataUse).toHaveBeenCalledWith(expect.any(Function), { sign, handle })
    expect(useErrorHandling).toHaveBeenCalledTimes(1)
    expect(useErrorHandling).toHaveBeenCalledWith(
      { tag: 'Loading' },
      { handle, retry: retryFetch },
    )

    await expect(pending[0]).resolves.toMatchObject({
      tag: 'Pdf',
      value: expect.objectContaining({ handle, pages: 3, type: 'pdf' }),
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const requestUrl = new URL(fetchMock.mock.calls[0][0])
    expect(requestUrl.pathname).toBe('/thumbnail')
    expect(requestUrl.searchParams.get('url')).toBe('https://signed-url.example.com/file')
    expect(requestUrl.searchParams.get('input')).toBe('pdf')
    expect(requestUrl.searchParams.get('size')).toBe('w1024h768')
    expect(requestUrl.searchParams.get('countPages')).toBe('true')
    expect(Array.from(requestUrl.searchParams.keys()).sort()).toEqual([
      'countPages',
      'input',
      'size',
      'url',
    ])
  })

  it('uses logicalKey over key to request pptx previews', async () => {
    const handle = { bucket: 'demo', key: 'hash.bin', logicalKey: 'slides.PPTX' }
    fetchMock.mockResolvedValue(
      new Response(new Blob(['pptx'], { type: 'application/pdf' }), {
        status: 200,
        headers: new Headers({ 'X-Quilt-Info': JSON.stringify({ page_count: 7 }) }),
      }),
    )

    render(React.createElement(Loader, { handle: handle as never, children: () => null }))

    expect(pending).toHaveLength(1)
    await expect(pending[0]).resolves.toMatchObject({
      tag: 'Pdf',
      value: expect.objectContaining({ type: 'pptx', pages: 7 }),
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const requestUrl = new URL(fetchMock.mock.calls[0][0])
    expect(requestUrl.searchParams.get('input')).toBe('pptx')
  })

  it('maps glacier 403 responses to PreviewError.Archived', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          error: 'Forbidden',
          text: "The operation is not valid for the object's storage class",
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

    expect(pending).toHaveLength(1)
    await expect(pending[0]).rejects.toMatchObject({ tag: 'Archived' })
  })

  it('maps non-glacier 403 responses to PreviewError.Forbidden', async () => {
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

    expect(pending).toHaveLength(1)
    await expect(pending[0]).rejects.toMatchObject({ tag: 'Forbidden' })
  })

  it('rethrows unexpected errors', async () => {
    fetchMock.mockRejectedValue(new Error('boom'))

    render(
      React.createElement(Loader, {
        handle: { bucket: 'demo', key: 'report.pdf' } as never,
        children: () => null,
      }),
    )

    expect(pending).toHaveLength(1)
    await expect(pending[0]).rejects.toThrow('boom')
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalledTimes(1)
  })
})
