import { v4 as uuidv4 } from 'uuid'

import { S3HandleBase, parseS3Url } from 'utils/s3paths'

import * as scripts from './scripts'
import * as signer from './signer'

type EventName = 'list-files' | 'get-file-url' | 'find-file-url' | 'sign-url'

export const EVENT_NAME: Record<string, EventName> = {
  FIND_FILE_URL: 'find-file-url',
  GET_FILE_URL: 'get-file-url',
  LIST_FILES: 'list-files',
  SIGN_URL: 'sign-url',
}

interface PartialS3Handle {
  bucket?: string
  key: string
}

type Payload = S3HandleBase | PartialS3Handle | string

export function requestEvent(
  eventName: EventName,
  payload?: Payload,
): Promise<S3HandleBase[] | string> {
  const EVENT_NAMESPACE = 'quilt-iframe-request'

  return new Promise((resolve, reject) => {
    const eventId = uuidv4()
    const handler = (event: MessageEvent) => {
      const { id, data } = event.data
      if (id !== eventId) return
      window.removeEventListener('message', handler)
      resolve(data)
    }
    try {
      // TODO: replace with one permanent event listener
      //       add new events to queue
      window.addEventListener('message', handler)
      window?.top?.postMessage({
        id: eventId,
        name: `${EVENT_NAMESPACE}-${eventName}`,
        payload,
      })
    } catch (error) {
      reject(error)
    }
  })
}

async function parseResponse(response: Response, handle: PartialS3Handle | string) {
  if (response.status !== 200) {
    const url =
      typeof handle === 'string'
        ? handle
        : `s3://${handle.bucket || window.quilt.env.packageHandle.bucket}/${handle.key}`
    return Promise.reject(new Error(`${response.statusText} ${url}`))
  }
  const contentType = response.headers.get('content-type')
  if (contentType === 'application/json') {
    const json = await response.json()
    const text = [
      json?.info?.data?.head?.join('\n'),
      json?.info?.data?.tail?.join('\n'),
    ].join('\n')
    try {
      return JSON.parse(text)
    } catch (e) {
      return text
    }
  }
  if (contentType === 'application/vnd.apache.arrow.file') {
    return response.arrayBuffer()
  }
  return response
}

function listFiles() {
  return requestEvent(EVENT_NAME.LIST_FILES) as Promise<S3HandleBase[]>
}

async function findFile(partialHandle: PartialS3Handle) {
  const url = (await requestEvent(EVENT_NAME.FIND_FILE_URL, partialHandle)) as string
  const response = await window.fetch(decodeURIComponent(url))
  return parseResponse(response, partialHandle)
}

async function fetchFile(handle: S3HandleBase) {
  const url = (await requestEvent(EVENT_NAME.GET_FILE_URL, handle)) as string
  const response = await window.fetch(decodeURIComponent(url))
  return parseResponse(response, handle)
}

if (!window.quilt) {
  window.quilt = {} as QuiltSdk
}

const signUrl = (url: string) => requestEvent(EVENT_NAME.SIGN_URL, url) as Promise<string>

const signAndFetch = async (url: string) => {
  try {
    const handle = parseS3Url(url)
    return await fetchFile(handle)
  } catch (error) {
    const signedUrl = await (requestEvent(EVENT_NAME.SIGN_URL, url) as Promise<string>)
    const response = await window.fetch(decodeURIComponent(signedUrl))
    return parseResponse(response, url)
  }
}

window.quilt.listFiles = listFiles
window.quilt.findFile = findFile
window.quilt.fetchFile = fetchFile
window.quilt.scripts = scripts
window.quilt.signer = {
  igv: signer.igv.bind(null, signUrl),
  echarts: signer.echarts.bind(null, signAndFetch),
  url: signUrl,
}
