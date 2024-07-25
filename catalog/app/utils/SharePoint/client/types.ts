export interface DriveItem {
  '@content.downloadUrl'?: string
  '@microsoft.graph.downloadUrl'?: string
  eTag: string
  folder: {}
  id: string
  lastModifiedDateTime?: string
  name: string
  parentReference: {
    id: string
    driveId: string
    name: string
  }
  size?: number
}

export interface DriveItemVersion {
  '@content.downloadUrl'?: string
  id: string
  lastModifiedDateTime: string
  size: number
}

export interface DriveItemVersionsList {
  value: DriveItemVersion[]
}

export interface PickedItem {
  '@sharePoint.endpoint': string
  folder?: {}
  id: string
  parentReference: {
    name?: string
    driveId: string
  }
}

export interface Preview {
  getUrl: string
}

export interface DriveItemChildren {
  value: DriveItem[]
}
