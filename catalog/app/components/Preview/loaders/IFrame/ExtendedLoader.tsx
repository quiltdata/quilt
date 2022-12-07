import * as React from 'react'

import * as AWS from 'utils/AWS'
import * as s3paths from 'utils/s3paths'
import type { PackageHandle } from 'utils/packageHandle'

import { PreviewData } from '../../types'

import * as utils from '../utils'

import useMessageBus from './SDK/messageBus'

const MAX_BYTES = 10 * 1024

interface Env {
  PreviewHandle: s3paths.S3HandleBase
  packageHandle: PackageHandle
}

interface PreviewHandle extends s3paths.S3HandleBase {
  packageHandle: PackageHandle
}

// TODO: return info and warnings as well
//       and render them with lambda warnings
function prepareSrcDoc(html: string, env: Env, scripts: string) {
  return html.replace(
    '</head>',
    `${scripts}

  <script>
    function onReady(callback) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => callback(window.quilt.env))
      } else {
        callback(window.quilt.env)
      }
    }
    if (!window.quilt) {
      window.quilt = {}
    }
    window.quilt.env = ${JSON.stringify(env)}
    window.quilt.onReady = onReady
  </script>
</head>`,
  )
}

function useContextEnv(handle: PreviewHandle): Env {
  return React.useMemo(() => {
    const { packageHandle, ...PreviewHandle } = handle
    return {
      PreviewHandle,
      packageHandle,
    }
  }, [handle])
}

function useInjectedScripts() {
  return React.useCallback(async () => {
    const response = await window.fetch('/__iframe-sdk')
    const html = await response.text()
    return html.replace('<html>', '').replace('</html>', '')
  }, [])
}

interface TextDataOutput {
  info: {
    data: {
      head: string[]
      tail: string[]
    }
    note: string
    warnings: string
  }
}

interface IFrameLoaderProps {
  children: (result: $TSFixMe) => React.ReactNode
  handle: PreviewHandle
}

export default function ExtendedIFrameLoader({ handle, children }: IFrameLoaderProps) {
  const env = useContextEnv(handle)

  const sign = AWS.Signer.useS3Signer()
  const onMessage = useMessageBus(handle)

  const injectScripts = useInjectedScripts()

  const src = React.useMemo(
    () => sign(handle, { ResponseContentType: 'text/html' }),
    [handle, sign],
  )
  const { result, fetch } = utils.usePreview({
    type: 'txt',
    handle,
    query: { max_bytes: MAX_BYTES },
  })
  const processed = utils.useAsyncProcessing(
    result,
    async ({ info: { data, note, warnings } }: TextDataOutput) => {
      const scripts = await injectScripts()
      const head = data.head.join('\n')
      const tail = data.tail.join('\n')
      // TODO: get storage class
      const srcDoc = prepareSrcDoc([head, tail].join('\n'), env, scripts)
      return PreviewData.IFrame({ onMessage, srcDoc, src, note, warnings })
    },
  )
  return children(utils.useErrorHandling(processed, { handle, retry: fetch }))
}
