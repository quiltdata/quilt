import { extname } from 'path'

import * as React from 'react'

import type { S3HandleBase } from 'utils/s3paths'
import AsyncResult from 'utils/AsyncResult'

import { PreviewData } from '../types'

import * as Json from './Json'
// import * as Tabular from './Tabular'

function getDataHandle(handle: S3HandleBase): S3HandleBase | null {
  if (handle.key.indexOf('.html') < 0) return null

  const key = handle.key.split('.html')[0]
  if (!extname(key)) return null

  return {
    ...handle,
    key,
  }
}

interface DataLoaderProps {
  handle: S3HandleBase
  children: (data?: any) => JSX.Element
}

const jsonOptions = { mode: 'json' }
// const csvOptions = { context: CONTEXT.FILE }

export default function DataLoader({ handle, children }: DataLoaderProps) {
  const dataHandle = getDataHandle(handle)
  return (
    <Json.Loader handle={dataHandle} options={jsonOptions}>
      {AsyncResult.case({
        Ok: PreviewData.case({
          Text: () => (
            <div>
              <h1>It works!</h1>
              {children()}
            </div>
          ),
          Json: ({ rendered }: $TSFixMe) => children(rendered),
          // Perspective: ({ data }: $TSFixMe) => children(btoa(new TextDecoder().decode(data))),
          _: () => null,
        }),
        Err: () => <h1>It doesn't work</h1>,
        _: () => null,
      })}
    </Json.Loader>
  )
}
