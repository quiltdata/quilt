import dedent from 'dedent'
import path from 'path'
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
    const rows = [
      ['a', 'b', 'c'],
      ['d', 'e,i,j,k', 'f'],
      ['g', 'h'],
    ]

    it('converts rows array to dictionary object, array of cells', () => {
      expect(
        spreadsheets.rowsToJson(rows, {
          mode: spreadsheets.Mode.SingleCellContainsAllValues,
        }),
      ).toEqual({
        a: ['b', 'c'],
        d: ['e,i,j,k', 'f'],
        g: 'h',
      })
    })

    it('converts rows array to dictionary object, one cell per value', () => {
      expect(spreadsheets.rowsToJson(rows)).toEqual({
        a: 'b',
        d: 'e,i,j,k',
        g: 'h',
      })
    })
  })

  describe('parseSpreadsheet', () => {
    const csv = dedent`
        a,b,c
        d,"e,i,j,k",f
        g,h
      `
    const workbook = xlsx.read(csv, { type: 'string', cellDates: true })
    const sheet = workbook.Sheets[workbook.SheetNames[0]]

    it('converts CSV to dictionary object, array of cells', () => {
      expect(
        spreadsheets.parseSpreadsheet(sheet, false, {
          mode: spreadsheets.Mode.SingleCellContainsAllValues,
        }),
      ).toEqual({
        a: ['b', 'c'],
        d: ['e,i,j,k', 'f'],
        g: 'h',
      })
    })

    it('converts CSV to dictionary object, one cell per value', () => {
      expect(spreadsheets.parseSpreadsheet(sheet, false)).toEqual({
        a: 'b',
        d: 'e,i,j,k',
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
      const workbook = xlsx.read(csv, { type: 'string', cellDates: true })
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
      const workbook = xlsx.read(csv, { type: 'string', cellDates: true })
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
      const workbook = xlsx.read(csv, { type: 'string', cellDates: true })
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

    describe('for Excel file', () => {
      const workbook = xlsx.readFile(
        path.resolve(__dirname, './spreadsheets.bilbo.ods'),
        { cellDates: true },
      )
      const sheet = workbook.Sheets[workbook.SheetNames[0]]

      it('parses values as primitives without Schema', () => {
        expect(spreadsheets.parseSpreadsheetAgainstSchema(sheet)).toEqual({
          Age: 131,
          Date: '2890-09-22',
          Fingers: '1,2,3,4,5,6,7,8,9,10',
          Male: true,
          Name: 'Bilbo Beggins',
          Parts: 'head,legs,arms',
        })
      })

      it('parses values as lists with Schema', () => {
        const bilboSchema = {
          type: 'object',
          properties: {
            Fingers: { type: 'array' },
            Parts: { type: 'array' },
          },
        }
        expect(spreadsheets.parseSpreadsheetAgainstSchema(sheet, bilboSchema)).toEqual({
          Age: 131,
          Date: '2890-09-22',
          Fingers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
          Male: true,
          Name: 'Bilbo Beggins',
          Parts: ['head', 'legs', 'arms'],
        })
      })
    })
  })

  describe('postProcess', () => {
    const obj = {
      a: 'b',
      d: 'e,i,j,k',
      g: 'h',
    }
    const schema = {
      type: 'object',
      properties: {
        d: { type: 'array' },
      },
    }
    expect(spreadsheets.postProcess(obj, schema)).toEqual({
      a: 'b',
      d: ['e', 'i', 'j', 'k'],
      g: 'h',
    })
  })
})
