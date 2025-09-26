import type * as Model from 'model'
import { calcStats } from './stats'
import { FilesState, FileWithHash } from './State'

jest.mock('constants/config', () => ({}))

// Mock the dependencies
jest.mock('./constants', () => ({
  MAX_UPLOAD_SIZE: 20 * 1000 * 1000 * 1000, // 20GB
  MAX_S3_SIZE: 50 * 1000 * 1000 * 1000, // 50GB
  MAX_FILE_COUNT: 1000,
}))

jest.mock('./State', () => ({
  isS3File: jest.fn(
    (f: any) => f && typeof f === 'object' && 'bucket' in f && 'key' in f,
  ),
}))

// Helper function to create a mock local file
const createMockLocalFile = (
  name: string,
  size: number,
  hashValue?: string,
  hashReady: boolean = true,
): FileWithHash =>
  ({
    name,
    size,
    type: 'text/plain',
    lastModified: Date.now(),
    webkitRelativePath: '',
    slice: jest.fn(),
    stream: jest.fn(),
    text: jest.fn(),
    arrayBuffer: jest.fn(),
    hash: {
      ready: hashReady,
      value: {
        type: 'sha2-256-chunked' as const,
        value: hashValue,
      },
      promise: Promise.resolve(hashValue),
    },
  }) as unknown as FileWithHash

// Helper function to create a mock S3 file
const createMockS3File = (key: string, size: number): Model.S3File => ({
  bucket: 'test-bucket',
  key,
  size,
})

// Helper function to create a mock package entry
const createMockPackageEntry = (size: number, hash: string): Model.PackageEntry => ({
  physicalKey: 's3://bucket/key',
  size,
  hash: {
    type: 'sha2-256-chunked' as const,
    value: hash,
  },
  meta: {},
})

describe('calcStats', () => {
  it('should calculate stats for empty state', () => {
    const state: FilesState = {
      added: {},
      deleted: {},
      existing: {},
    }

    const result = calcStats(state)

    expect(result).toEqual({
      upload: { count: 0, size: 0 },
      s3: { count: 0, size: 0 },
      hashing: false,
      warn: null,
    })
  })

  it('should calculate stats for local files to upload', () => {
    const file1 = createMockLocalFile('file1.txt', 1000)
    const file2 = createMockLocalFile('file2.txt', 2000)

    const state: FilesState = {
      added: {
        'file1.txt': file1,
        'file2.txt': file2,
      },
      deleted: {},
      existing: {},
    }

    const result = calcStats(state)

    expect(result).toEqual({
      upload: { count: 2, size: 3000 },
      s3: { count: 0, size: 0 },
      hashing: false,
      warn: null,
    })
  })

  it('should calculate stats for S3 files', () => {
    const s3File1 = createMockS3File('file1.txt', 5000)
    const s3File2 = createMockS3File('file2.txt', 3000)

    const state: FilesState = {
      added: {
        'file1.txt': s3File1,
        'file2.txt': s3File2,
      },
      deleted: {},
      existing: {},
    }

    const result = calcStats(state)

    expect(result).toEqual({
      upload: { count: 0, size: 0 },
      s3: { count: 2, size: 8000 },
      hashing: false,
      warn: null,
    })
  })

  it('should calculate stats for mixed local and S3 files', () => {
    const localFile = createMockLocalFile('local.txt', 1000)
    const s3File = createMockS3File('s3.txt', 2000)

    const state: FilesState = {
      added: {
        'local.txt': localFile,
        's3.txt': s3File,
      },
      deleted: {},
      existing: {},
    }

    const result = calcStats(state)

    expect(result).toEqual({
      upload: { count: 1, size: 1000 },
      s3: { count: 1, size: 2000 },
      hashing: false,
      warn: null,
    })
  })

  it('should detect hashing in progress', () => {
    const hashingFile = createMockLocalFile('hashing.txt', 1000, undefined, false)

    const state: FilesState = {
      added: {
        'hashing.txt': hashingFile,
      },
      deleted: {},
      existing: {},
    }

    const result = calcStats(state)

    expect(result).toEqual({
      upload: { count: 1, size: 1000 },
      s3: { count: 0, size: 0 },
      hashing: true,
      warn: null,
    })
  })

  it('should not count files that are unchanged', () => {
    const file = createMockLocalFile('file.txt', 1000, 'samehash')
    const existing = {
      'file.txt': createMockPackageEntry(1000, 'samehash'),
    }

    const state: FilesState = {
      added: {
        'file.txt': file,
      },
      deleted: {},
      existing,
    }

    const result = calcStats(state)

    expect(result).toEqual({
      upload: { count: 0, size: 0 },
      s3: { count: 0, size: 0 },
      hashing: false,
      warn: null,
    })
  })

  it('should count files that are modified (different hash)', () => {
    const file = createMockLocalFile('file.txt', 1000, 'newhash')
    const existing = {
      'file.txt': createMockPackageEntry(1000, 'oldhash'),
    }

    const state: FilesState = {
      added: {
        'file.txt': file,
      },
      deleted: {},
      existing,
    }

    const result = calcStats(state)

    expect(result).toEqual({
      upload: { count: 1, size: 1000 },
      s3: { count: 0, size: 0 },
      hashing: false,
      warn: null,
    })
  })

  it('should generate upload size warning', () => {
    const largeFile = createMockLocalFile('large.txt', 25 * 1000 * 1000 * 1000) // 25GB

    const state: FilesState = {
      added: {
        'large.txt': largeFile,
      },
      deleted: {},
      existing: {},
    }

    const result = calcStats(state)

    expect(result.warn).toEqual({
      upload: true,
      s3: false,
      count: false,
    })
  })

  it('should generate S3 size warning', () => {
    const largeS3File = createMockS3File('large.txt', 60 * 1000 * 1000 * 1000) // 60GB

    const state: FilesState = {
      added: {
        'large.txt': largeS3File,
      },
      deleted: {},
      existing: {},
    }

    const result = calcStats(state)

    expect(result.warn).toEqual({
      upload: false,
      s3: true,
      count: false,
    })
  })

  it('should generate file count warning', () => {
    const files: Record<string, FileWithHash> = {}
    for (let i = 0; i < 1001; i++) {
      files[`file${i}.txt`] = createMockLocalFile(`file${i}.txt`, 100)
    }

    const state: FilesState = {
      added: files,
      deleted: {},
      existing: {},
    }

    const result = calcStats(state)

    expect(result.warn).toEqual({
      upload: false,
      s3: false,
      count: true,
    })
  })

  it('should generate multiple warnings', () => {
    const largeFile = createMockLocalFile('large.txt', 25 * 1000 * 1000 * 1000) // 25GB
    const largeS3File = createMockS3File('large-s3.txt', 60 * 1000 * 1000 * 1000) // 60GB

    const state: FilesState = {
      added: {
        'large.txt': largeFile,
        'large-s3.txt': largeS3File,
      },
      deleted: {},
      existing: {},
    }

    const result = calcStats(state)

    expect(result.warn).toEqual({
      upload: true,
      s3: true,
      count: false,
    })
  })

  it('should return null for warn when no warnings', () => {
    const file = createMockLocalFile('small.txt', 1000)

    const state: FilesState = {
      added: {
        'small.txt': file,
      },
      deleted: {},
      existing: {},
    }

    const result = calcStats(state)

    expect(result.warn).toBeNull()
  })
})
