/* eslint-disable no-console */
/**
 * Test file for JWT decompression utilities
 * Run this to verify the decompression works correctly
 */

// Import the decompression utilities
const {
  decompressPermissions,
  decompressBuckets,
  processCompressedJWT,
  safeDecompressJWT,
} = require('./jwt-decompression-utils')

// Test cases
const testCases = [
  {
    name: 'Permission Decompression',
    test: () => {
      const abbreviated = ['g', 'p', 'd', 'l', 'la']
      const result = decompressPermissions(abbreviated)
      const expected = [
        's3:GetObject',
        's3:PutObject',
        's3:DeleteObject',
        's3:ListBucket',
        's3:ListAllMyBuckets',
      ]
      return JSON.stringify(result) === JSON.stringify(expected)
    },
  },
  {
    name: 'Groups Bucket Decompression',
    test: () => {
      const bucketData = {
        _type: 'groups',
        _data: {
          quilt: ['sandbox-bucket', 'sales-raw'],
          cell: ['cellpainting-gallery'],
        },
      }
      const result = decompressBuckets(bucketData)
      const expected = [
        'quilt-sandbox-bucket',
        'quilt-sales-raw',
        'cell-cellpainting-gallery',
      ]
      return JSON.stringify(result) === JSON.stringify(expected)
    },
  },
  {
    name: 'Patterns Bucket Decompression',
    test: () => {
      const bucketData = {
        _type: 'patterns',
        _data: {
          quilt: ['sandbox-bucket', 'sales-raw'],
          other: ['data-drop-off-bucket'],
        },
      }
      const result = decompressBuckets(bucketData)
      const expected = ['quilt-sandbox-bucket', 'quilt-sales-raw', 'data-drop-off-bucket']
      return JSON.stringify(result) === JSON.stringify(expected)
    },
  },
  {
    name: 'No Compression Bucket Data',
    test: () => {
      const bucketData = ['quilt-sandbox-bucket', 'quilt-sales-raw']
      const result = decompressBuckets(bucketData)
      return JSON.stringify(result) === JSON.stringify(bucketData)
    },
  },
  {
    name: 'Complete JWT Processing',
    test: () => {
      const compressedJWT = {
        s: 'w',
        p: ['g', 'p', 'd', 'l'],
        r: ['ReadWriteQuiltV2-sales-prod'],
        b: {
          _type: 'groups',
          _data: {
            quilt: ['sandbox-bucket', 'sales-raw'],
          },
        },
        buckets: ['quilt-sandbox-bucket', 'quilt-sales-raw'],
        permissions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject', 's3:ListBucket'],
        roles: ['ReadWriteQuiltV2-sales-prod'],
        scope: 'w',
        level: 'write',
        l: 'write',
        iss: 'quilt-frontend',
        aud: 'quilt-mcp-server',
        sub: 'user-123',
        iat: 1758740633,
        exp: 1758827033,
        jti: 'abc123',
      }

      const result = processCompressedJWT(compressedJWT)

      return (
        result.scope === 'w' &&
        result.permissions.length === 4 &&
        result.permissions.includes('s3:GetObject') &&
        result.roles.length === 1 &&
        result.buckets.length === 2 &&
        result.buckets.includes('quilt-sandbox-bucket') &&
        result.level === 'write' &&
        result.iss === 'quilt-frontend'
      )
    },
  },
  {
    name: 'Error Handling',
    test: () => {
      const malformedJWT = {
        s: 'w',
        p: null, // Invalid data
        r: ['ReadWriteQuiltV2-sales-prod'],
        b: 'invalid', // Invalid data
        l: 'write',
      }

      const result = safeDecompressJWT(malformedJWT)

      // Should return fallback values without throwing
      return (
        result.scope === 'w' &&
        Array.isArray(result.permissions) &&
        Array.isArray(result.buckets) &&
        result.level === 'write'
      )
    },
  },
]

// Run tests
console.log('🧪 Running JWT Decompression Tests...\n')

let passed = 0
let failed = 0

testCases.forEach((testCase, index) => {
  try {
    const result = testCase.test()
    if (result) {
      console.log(`✅ Test ${index + 1}: ${testCase.name} - PASSED`)
      passed++
    } else {
      console.log(`❌ Test ${index + 1}: ${testCase.name} - FAILED`)
      failed++
    }
  } catch (error) {
    console.log(`💥 Test ${index + 1}: ${testCase.name} - ERROR: ${error.message}`)
    failed++
  }
})

console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`)

if (failed === 0) {
  console.log('🎉 All tests passed! JWT decompression is working correctly.')
} else {
  console.log('⚠️  Some tests failed. Please check the implementation.')
}

// Example usage demonstration
console.log('\n📝 Example Usage:')
console.log('const decompressed = processCompressedJWT(jwtPayload);')
console.log('console.log("Permissions:", decompressed.permissions);')
console.log('console.log("Buckets:", decompressed.buckets);')
