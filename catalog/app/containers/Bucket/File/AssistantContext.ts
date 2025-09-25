import * as Eff from 'effect'
import * as React from 'react'

import * as Assistant from 'components/Assistant'
import * as ContextFiles from 'components/Assistant/Model/ContextFiles'
import * as AWS from 'utils/AWS'
import * as XML from 'utils/XML'

import { ObjectExistence } from '../requests'

interface VersionsContextProps {
  data: $TSFixMe
}

export const VersionsContext = Assistant.Context.LazyContext(
  ({ data }: VersionsContextProps) => {
    const msg = React.useMemo(
      () =>
        Eff.pipe(
          data.case({
            Ok: (vs: $TSFixMe[]) =>
              Eff.Option.some(
                vs.map((v) =>
                  XML.tag('version', { id: v.id }, JSON.stringify(v, null, 2)),
                ),
              ),
            Err: () => Eff.Option.some(['Error fetching versions']),
            _: () => Eff.Option.none(),
          }),
          Eff.Option.map((children: Array<XML.Tag | string>) =>
            XML.tag('object-versions', {}, ...children).toString(),
          ),
        ),
      [data],
    )

    return {
      markers: { versionsReady: Eff.Option.isSome(msg) },
      messages: Eff.Option.toArray(msg),
    }
  },
)

interface CurrentVersionContextProps {
  version: string
  objExistsData: $TSFixMe
  versionExistsData: $TSFixMe
}

export const CurrentVersionContext = Assistant.Context.LazyContext(
  ({ version, objExistsData, versionExistsData }: CurrentVersionContextProps) => {
    const msg = React.useMemo(
      () =>
        Eff.pipe(
          objExistsData.case({
            _: () => Eff.Option.none(),
            Err: (e: $TSFixMe) =>
              Eff.Option.some(
                `Could not get object data: ${
                  e.code === 'Forbidden' ? 'Access Denied' : e
                }`,
              ),
            Ok: ObjectExistence.case({
              DoesNotExist: () => Eff.Option.some('Object does not exist'),
              Exists: () =>
                versionExistsData.case({
                  _: () => Eff.Option.none(),
                  Err: (e: $TSFixMe) =>
                    Eff.Option.some(`Could not get current object version data: ${e}`),
                  Ok: ObjectExistence.case({
                    Exists: (v: $TSFixMe) =>
                      Eff.Option.some(
                        JSON.stringify(
                          {
                            deleted: v.deleted,
                            archived: v.archived,
                            id: v.version,
                            lastModified: v.lastModified,
                          },
                          null,
                          2,
                        ),
                      ),
                    DoesNotExist: () => Eff.Option.some('Object version does not exist'),
                  }),
                }),
            }),
          }),
          Eff.Option.map((children: string) =>
            XML.tag(
              'object-current-version',
              {},
              `Currently displayed version: ${version || 'latest'}`,
              children,
            ).toString(),
          ),
        ),
      [version, objExistsData, versionExistsData],
    )

    return {
      markers: { currentVersionReady: Eff.Option.isSome(msg) },
      messages: Eff.Option.toArray(msg),
    }
  },
)

interface FileContextFilesProps {
  bucket: string
  path: string
}

export const FileContextFiles = Assistant.Context.LazyContext(
  ({ bucket, path }: FileContextFilesProps) => {
    const s3 = AWS.S3.use()
    const [contextFiles, setContextFiles] = React.useState<
      ContextFiles.ContextFileContent[] | null
    >(null)
    const [loading, setLoading] = React.useState(true)

    React.useEffect(() => {
      const loadContextFiles = async () => {
        setLoading(true)
        try {
          // Get parent directory of the file
          const lastSlash = path.lastIndexOf('/')
          const parentPath = lastSlash > 0 ? path.substring(0, lastSlash) : ''

          // Load hierarchy from parent directory up to (but excluding) bucket root
          const files = await ContextFiles.loadContextFileHierarchy(
            s3,
            bucket,
            parentPath,
            '', // Stop at bucket root (empty string)
          )
          setContextFiles(files)
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Error loading file context files:', error)
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
      markers: { fileContextFilesReady: !loading && contextFiles !== null },
      messages,
    }
  },
)
