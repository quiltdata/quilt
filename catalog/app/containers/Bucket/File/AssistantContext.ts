import * as Eff from 'effect'
import * as React from 'react'

import * as Assistant from 'components/Assistant'
import * as ContextFiles from 'components/Assistant/Model/ContextFiles'
import * as XML from 'utils/XML'
import * as S3Paths from 'utils/s3paths'

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
    const messagesO = ContextFiles.useBucketDirContextFiles(
      bucket,
      S3Paths.getPrefix(path),
    )
    return {
      markers: { fileContextFilesReady: Eff.Option.isSome(messagesO) },
      messages: Eff.Option.getOrUndefined(messagesO),
    }
  },
)
