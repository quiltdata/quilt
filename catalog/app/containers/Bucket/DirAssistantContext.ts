import * as Eff from 'effect'
import * as React from 'react'

import * as Assistant from 'components/Assistant'
import * as ContextFiles from 'components/Assistant/Model/ContextFiles'
import * as AWS from 'utils/AWS'
import * as XML from 'utils/XML'

import type { BucketListingResult } from './requests'

interface ListingContextProps {
  data: $TSFixMe
}

export const ListingContext = Assistant.Context.LazyContext(
  ({ data }: ListingContextProps) => {
    const msg = React.useMemo(
      () =>
        Eff.pipe(
          data.case({
            Ok: (res: BucketListingResult) => Eff.Option.some(Eff.Either.right(res)),
            Err: () => Eff.Option.some(Eff.Either.left('Error fetching listing data')),
            _: () => Eff.Option.none(),
          }) as Eff.Option.Option<Eff.Either.Either<BucketListingResult, string>>,
          Eff.Option.map(
            Eff.Either.match({
              onLeft: (err) => [err],
              onRight: (res) => [
                res.truncated ? 'The listing is truncated' : null,
                res.dirs.length ? XML.tag('prefixes', {}, ...res.dirs) : null,
                res.files.length
                  ? XML.tag(
                      'objects',
                      {},
                      ...res.files.map((o) =>
                        JSON.stringify({
                          key: o.key,
                          size: o.size,
                          modified: o.modified.toISOString(),
                        }),
                      ),
                    )
                  : null,
              ],
            }),
          ),
          Eff.Option.map((children: XML.Children) =>
            XML.tag('listing-data', {}, ...children).toString(),
          ),
        ),
      [data],
    )

    return {
      markers: { listingReady: Eff.Option.isSome(msg) },
      messages: Eff.Option.toArray(msg),
    }
  },
)

interface DirContextFilesProps {
  bucket: string
  path: string
}

export const DirContextFiles = Assistant.Context.LazyContext(
  ({ bucket, path }: DirContextFilesProps) => {
    const s3 = AWS.S3.use()
    const [contextFiles, setContextFiles] = React.useState<
      ContextFiles.ContextFileContent[] | null
    >(null)
    const [loading, setLoading] = React.useState(true)

    React.useEffect(() => {
      const loadContextFiles = async () => {
        setLoading(true)
        try {
          // Load hierarchy from current path up to (but excluding) bucket root
          const files = await ContextFiles.loadContextFileHierarchy(
            s3,
            bucket,
            path,
            '', // Stop at bucket root (empty string)
          )
          setContextFiles(files)
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Error loading directory context files:', error)
          setContextFiles([])
        } finally {
          setLoading(false)
        }
      }

      loadContextFiles()
    }, [bucket, path, s3])

    const messages = React.useMemo(() => {
      if (!contextFiles || contextFiles.length === 0) return []
      return ContextFiles.formatContextFilesAsMessages(contextFiles)
    }, [contextFiles])

    return {
      markers: { dirContextFilesReady: !loading && contextFiles !== null },
      messages,
    }
  },
)
