import dedent from 'dedent'
import xlsx from 'xlsx'

import * as spreadsheets from './spreadsheets'

describe('utils/spreadsheets', () => {
  describe('parseCellsAsValues', () => {
    it('parses to single value', () => {
      expect(spreadsheets.parseCellsAsValues(['abc'])).toBe('abc')
    })

    it('parses to list of values', () => {
      expect(spreadsheets.parseCellsAsValues(['abc', null, undefined, 'ghi'])).toEqual([
        'abc',
        'ghi',
      ])
    })
  })

  describe('rowsToJson', () => {
    it('converts rows array to dictionary object', () => {
      const rows = [
        ['a', 'b', 'c'],
        ['d', 'e', 'f'],
        ['g', 'h'],
      ]
      expect(spreadsheets.rowsToJson(rows)).toEqual({
        a: ['b', 'c'],
        d: ['e', 'f'],
        g: 'h',
      })
    })
  })

  describe('parseSpreadsheet', () => {
    it('converts CSV to dictionary object', () => {
      const csv = dedent`
        a,b,c
        d,e,f
        g,h
      `
      const workbook = xlsx.read(csv, { type: 'string' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      expect(spreadsheets.parseSpreadsheet(sheet, false)).toEqual({
        a: ['b', 'c'],
        d: ['e', 'f'],
        g: 'h',
      })
    })
  })

  describe('scoreObjectDiff', () => {
    it('object with more keys in commont has bigger score', () => {
      const testA = { a: 1, b: 2, c: 3 }
      const testB = { c: 4, d: 5, e: 6 }
      const control = { b: 123, c: 456 }
      const scoreA = spreadsheets.scoreObjectDiff(testA, control)
      const scoreB = spreadsheets.scoreObjectDiff(testB, control)
      expect(scoreA > scoreB).toBe(true)
    })
  })

  describe('parseSpreadsheetAgainstSchema', () => {
    const schema = {
      type: 'object',
      properties: {
        b: { type: 'number' },
        c: { type: 'number' },
      },
    }

    it('parse vertical spreadsheet', () => {
      const csv = dedent`
        b,c
        1,2
      `
      const workbook = xlsx.read(csv, { type: 'string' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      expect(spreadsheets.parseSpreadsheetAgainstSchema(sheet, schema)).toEqual({
        b: 1,
        c: 2,
      })
    })

    it('parse horizontal spreadsheet', () => {
      const csv = dedent`
        b,1
        c,2
      `
      const workbook = xlsx.read(csv, { type: 'string' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      expect(spreadsheets.parseSpreadsheetAgainstSchema(sheet, schema)).toEqual({
        b: 1,
        c: 2,
      })
    })

    it('parse as vertical when no keys in common', () => {
      const csv = dedent`
        d,e,f
        1,2,3
      `
      const workbook = xlsx.read(csv, { type: 'string' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      expect(spreadsheets.parseSpreadsheetAgainstSchema(sheet, schema)).toEqual({
        d: 1,
        e: 2,
        f: 3,
      })
    })

    it('parse invalid data with no error', () => {
      const sheet = ['123']
      expect(spreadsheets.parseSpreadsheetAgainstSchema(sheet, schema)).toEqual({})
    })
  })
})
