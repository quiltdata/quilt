import dedent from 'dedent'
import xlsx from 'xlsx'

import * as spreadsheets from './spreadsheets'

describe('utils/spreadsheets', () => {
  describe('rowsToJson', () => {
    test('converts rows array to dictionary object', () => {
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
    test('converts CSV to dictionary object', () => {
      const csv = dedent`
        a,b,c
        d,e,f
        g,h
      `
      const workbook = xlsx.read(csv, { type: 'string' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      expect(spreadsheets.parseSpreadsheet(sheet)).toEqual({
        a: ['b', 'c'],
        d: ['e', 'f'],
        g: 'h',
      })
    })
  })

  describe('scoreObjectDiff', () => {
    test('object with more keys in commont has bigger score', () => {
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

    test('parse vertical spreadsheet', () => {
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

    test('parse horizontal spreadsheet', () => {
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

    test('parse as vertical when no keys in common', () => {
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

    test('parse invalid data with no error', () => {
      const sheet = ['123']
      expect(spreadsheets.parseSpreadsheetAgainstSchema(sheet, schema)).toEqual({})
    })
  })
})
