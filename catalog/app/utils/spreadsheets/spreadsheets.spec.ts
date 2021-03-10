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
      const bilboSchema = {
        type: 'object',
        properties: {
          Fingers: { type: 'array' },
          Parts: { type: 'array' },
        },
      }
      const outputStrings = {
        Age: 131,
        Date: '2890-09-22',
        Fingers: '1,2,3,4,5,6,7,8,9,10',
        Male: true,
        Name: 'Bilbo Beggins',
        Parts: 'head,legs,arms',
      }
      const outputLists = {
        Age: 131,
        Date: '2890-09-22',
        Fingers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        Male: true,
        Name: 'Bilbo Beggins',
        Parts: ['head', 'legs', 'arms'],
      }

      it('parses OpenOffice archive format', () => {
        const workbook = xlsx.readFile(
          path.resolve(__dirname, './mocks/spreadsheets.bilbo.ods'),
          { cellDates: true },
        )
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        expect(spreadsheets.parseSpreadsheetAgainstSchema(sheet)).toEqual(outputStrings)
        expect(spreadsheets.parseSpreadsheetAgainstSchema(sheet, bilboSchema)).toEqual(
          outputLists,
        )
      })

      it('parses OpenOffice single XML format', () => {
        const workbook = xlsx.readFile(
          path.resolve(__dirname, './mocks/spreadsheets.bilbo.fods'),
          { cellDates: true },
        )
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        expect(spreadsheets.parseSpreadsheetAgainstSchema(sheet)).toEqual(outputStrings)
        expect(spreadsheets.parseSpreadsheetAgainstSchema(sheet, bilboSchema)).toEqual(
          outputLists,
        )
      })

      it('parses CSV format', () => {
        const workbook = xlsx.readFile(
          path.resolve(__dirname, './mocks/spreadsheets.bilbo.csv'),
          { cellDates: true },
        )
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        expect(spreadsheets.parseSpreadsheetAgainstSchema(sheet)).toEqual(outputStrings)
        expect(spreadsheets.parseSpreadsheetAgainstSchema(sheet, bilboSchema)).toEqual(
          outputLists,
        )
      })

      it('parses XLS format', () => {
        const workbook = xlsx.readFile(
          path.resolve(__dirname, './mocks/spreadsheets.bilbo.xls'),
          { cellDates: true },
        )
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        expect(spreadsheets.parseSpreadsheetAgainstSchema(sheet)).toEqual(outputStrings)
        expect(spreadsheets.parseSpreadsheetAgainstSchema(sheet, bilboSchema)).toEqual(
          outputLists,
        )
      })

      it('parses XLSX format', () => {
        const workbook = xlsx.readFile(
          path.resolve(__dirname, './mocks/spreadsheets.bilbo.xlsx'),
          { cellDates: true },
        )
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        expect(spreadsheets.parseSpreadsheetAgainstSchema(sheet)).toEqual(outputStrings)
        expect(spreadsheets.parseSpreadsheetAgainstSchema(sheet, bilboSchema)).toEqual(
          outputLists,
        )
      })

      it('parses XLSM format', () => {
        const workbook = xlsx.readFile(
          path.resolve(__dirname, './mocks/spreadsheets.bilbo.xlsm'),
          { cellDates: true },
        )
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        expect(spreadsheets.parseSpreadsheetAgainstSchema(sheet)).toEqual(outputStrings)
        expect(spreadsheets.parseSpreadsheetAgainstSchema(sheet, bilboSchema)).toEqual(
          outputLists,
        )
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
