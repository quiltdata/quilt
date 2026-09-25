import { describe, expect, it } from 'vitest'

import { checkDefinition, referencedBuckets } from './fixtureAdapter'

/**
 * The static checks, and the parse under them.
 *
 * Neither had a test, so the case this file exists for — a mixed-case identifier —
 * shipped broken and was described as fixed. Athena identifiers are
 * case-insensitive, so `FROM "Fixture_Assay_Raw".plates` is valid SQL over a bucket
 * the workspace holds; the parse lowercased nothing, produced `Fixture-Assay-Raw`,
 * and the check then reported a bucket outside the reach for a definition that was
 * fine.
 */

const REACH = ['fixture-assay-raw', 'fixture-cohort-ref']

describe('model/DataProducts/fixtureAdapter', () => {
  describe('referencedBuckets', () => {
    it('maps a substrate schema to its bucket name', () => {
      expect(referencedBuckets('SELECT * FROM "fixture_assay_raw".objects')).toEqual([
        'fixture-assay-raw',
      ])
    })

    it('lowercases a mixed-case identifier', () => {
      // The bug: the `i` flag matches uppercase, and the capture was only
      // underscore-mapped.
      expect(referencedBuckets('SELECT * FROM "Fixture_Assay_Raw".plates')).toEqual([
        'fixture-assay-raw',
      ])
    })

    it('lowercases an all-caps identifier', () => {
      expect(referencedBuckets('SELECT * FROM "FIXTURE_ASSAY_RAW".plates')).toEqual([
        'fixture-assay-raw',
      ])
    })

    it('reads a JOIN as well as a FROM, and dedupes', () => {
      const sql =
        'SELECT * FROM "fixture_assay_raw".objects o\n' +
        'JOIN "fixture_cohort_ref".plates p ON p.id = o.id\n' +
        'JOIN "fixture_assay_raw".runs r ON r.id = o.run_id'
      expect(referencedBuckets(sql)).toEqual(['fixture-assay-raw', 'fixture-cohort-ref'])
    })

    it('reads an unquoted identifier', () => {
      expect(referencedBuckets('SELECT * FROM fixture_assay_raw.objects')).toEqual([
        'fixture-assay-raw',
      ])
    })

    it('finds nothing in SQL that names no table', () => {
      expect(referencedBuckets('SELECT 1')).toEqual([])
    })
  })

  describe('checkDefinition', () => {
    const valid =
      "SELECT concat('a/', o.name) AS logical_key, o.bucket, o.key\n" +
      'FROM "fixture_assay_raw".objects o'

    it('passes a definition over a bucket in reach', () => {
      const check = checkDefinition(valid, REACH)
      expect(check.valid).toBe(true)
      expect(check.errors).toEqual([])
      expect(check.outOfReach).toEqual([])
    })

    it('passes the same definition written in mixed case', () => {
      // The regression this file exists for: a valid definition reported as
      // out-of-reach because of identifier casing.
      const check = checkDefinition(
        valid.replace('fixture_assay_raw', 'Fixture_Assay_Raw'),
        REACH,
      )
      expect(check.outOfReach).toEqual([])
      expect(check.valid).toBe(true)
    })

    it('names a bucket the workspace does not hold', () => {
      const check = checkDefinition(
        valid.replace('fixture_assay_raw', 'fixture_someone_else'),
        REACH,
      )
      expect(check.valid).toBe(false)
      expect(check.outOfReach).toEqual(['fixture-someone-else'])
      expect(check.errors.join(' ')).toContain('does not hold s3://fixture-someone-else')
    })

    it('requires a logical_key column, and says the rest is unsettled', () => {
      const check = checkDefinition(
        'SELECT o.bucket FROM "fixture_assay_raw".objects o',
        REACH,
      )
      expect(check.valid).toBe(false)
      expect(check.errors.join(' ')).toContain('logical_key')
      // The copy must not imply a full output-contract check ran: D-J is open.
      expect(check.errors.join(' ')).toContain('not settled yet')
    })

    it('refuses anything that is not a SELECT', () => {
      // A product is read-only and composes from physical volumes (DEC-50, DEC-51).
      const check = checkDefinition('DROP TABLE "fixture_assay_raw".objects', REACH)
      expect(check.valid).toBe(false)
      expect(check.errors.join(' ')).toContain('must be a SELECT')
    })

    it('refuses an empty definition', () => {
      expect(checkDefinition('   ', REACH).errors.join(' ')).toContain('is empty')
    })

    it('never returns a sample, because no run happens before designation', () => {
      // UNK-C4 is open: Fig. 4 validates after the view exists, and inventing
      // candidate rows would answer that question in the reader's favour.
      expect(checkDefinition(valid, REACH).sample).toBeNull()
    })
  })
})
