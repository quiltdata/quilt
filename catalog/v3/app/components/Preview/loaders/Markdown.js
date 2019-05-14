import { dirname, resolve } from 'path'

import * as R from 'ramda'

import { getRenderer } from 'components/Markdown'
import * as Resource from 'utils/Resource'

import { PreviewData } from '../types'
import * as utils from './utils'

const signImg = ({ signer, handle }) =>
  R.evolve({
    src: (src) =>
      signer.signResource({
        ptr: Resource.parse(src),
        ctx: { type: Resource.ContextType.MDImg(), handle },
      }),
  })

const processLink = ({ urls, signer, handle }) =>
  R.evolve({
    href: R.pipe(
      Resource.parse,
      Resource.Pointer.case({
        Path: (p) => {
          const hasSlash = p.endsWith('/')
          const resolved = resolve(dirname(handle.key), p).slice(1)
          const normalized = hasSlash ? `${resolved}/` : resolved
          return hasSlash
            ? urls.bucketDir(handle.bucket, normalized)
            : urls.bucketFile(handle.bucket, normalized)
        },
        _: (ptr) =>
          signer.signResource({
            ptr,
            ctx: { type: Resource.ContextType.MDLink(), handle },
          }),
      }),
    ),
  })

const fetch = utils.gatedS3Request(
  utils.objectGetter((r, { handle, signer, urls }) => {
    const contents = r.Body.toString('utf-8')
    const rendered = getRenderer({
      images: true,
      processImg: signImg({ signer, handle }),
      processLink: processLink({ urls, signer, handle }),
    })(contents)
    return PreviewData.Markdown({ rendered })
  }),
)

export const detect = utils.extIn(['.md', '.rmd'])

export const load = (handle, callback) =>
  utils.withSigner((signer) =>
    utils.withRoutes(({ urls }) => fetch(handle, callback, { signer, urls })),
  )
