import dedent from 'dedent'
import path from 'path'
import * as R from 'ramda'
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
        null,
        undefined,
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
      expect(spreadsheets.rowsToJson(rows)).toEqual({
        a: ['b', 'c'],
        d: ['e,i,j,k', 'f'],
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
      expect(spreadsheets.parseSpreadsheet(sheet, false)).toEqual({
        a: ['b', 'c'],
        d: ['e,i,j,k', 'f'],
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

    describe('for flat Excel files', () => {
      const bilboSchema = {
        type: 'object',
        properties: {
          Fingers: { type: 'array' },
          Male: { type: 'boolean' },
          Parts: { type: 'array' },
        },
      }
      const outputRaw = {
        Age: 131,
        Date: '1990-09-22',
        Fingers: '1,2,3,4,5,6,7,8,9,10',
        Male: true,
        Name: 'Bilbo Beggins',
        Parts: 'head,legs,arms',
      }
      const outputSchemed = {
        Age: 131,
        Date: '1990-09-22',
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
        expect(spreadsheets.parseSpreadsheetAgainstSchema(sheet)).toEqual(outputRaw)
        expect(spreadsheets.parseSpreadsheetAgainstSchema(sheet, bilboSchema)).toEqual(
          outputSchemed,
        )
      })

      it('parses OpenOffice single XML format', () => {
        const workbook = xlsx.readFile(
          path.resolve(__dirname, './mocks/spreadsheets.bilbo.fods'),
          { cellDates: true },
        )
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        expect(spreadsheets.parseSpreadsheetAgainstSchema(sheet)).toEqual(outputRaw)
        expect(spreadsheets.parseSpreadsheetAgainstSchema(sheet, bilboSchema)).toEqual(
          outputSchemed,
        )
      })

      it('parses CSV format', () => {
        const workbook = xlsx.readFile(
          path.resolve(__dirname, './mocks/spreadsheets.bilbo.csv'),
          { cellDates: true },
        )
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        expect(spreadsheets.parseSpreadsheetAgainstSchema(sheet)).toEqual(outputRaw)
        expect(spreadsheets.parseSpreadsheetAgainstSchema(sheet, bilboSchema)).toEqual(
          outputSchemed,
        )
      })

      it('parses XLS format', () => {
        const workbook = xlsx.readFile(
          path.resolve(__dirname, './mocks/spreadsheets.bilbo.xls'),
          { cellDates: true },
        )
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        expect(spreadsheets.parseSpreadsheetAgainstSchema(sheet)).toEqual(outputRaw)
        expect(spreadsheets.parseSpreadsheetAgainstSchema(sheet, bilboSchema)).toEqual(
          outputSchemed,
        )
      })

      it('parses XLSX format', () => {
        const workbook = xlsx.readFile(
          path.resolve(__dirname, './mocks/spreadsheets.bilbo.xlsx'),
          { cellDates: true },
        )
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        expect(spreadsheets.parseSpreadsheetAgainstSchema(sheet)).toEqual(
          R.assoc('Male', 1, outputRaw),
        )
        expect(spreadsheets.parseSpreadsheetAgainstSchema(sheet, bilboSchema)).toEqual(
          outputSchemed,
        )
      })

      it('parses XLSM format', () => {
        const workbook = xlsx.readFile(
          path.resolve(__dirname, './mocks/spreadsheets.bilbo.xlsm'),
          { cellDates: true },
        )
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        expect(spreadsheets.parseSpreadsheetAgainstSchema(sheet)).toEqual(
          R.assoc('Male', 1, outputRaw),
        )
        expect(spreadsheets.parseSpreadsheetAgainstSchema(sheet, bilboSchema)).toEqual(
          outputSchemed,
        )
      })
    })

    describe('for multivalued Excel files', () => {
      const hobbitsSchema = {
        type: 'object',
        properties: {
          Fingers: {
            type: 'array',
            items: { type: 'array' },
          },
          Male: {
            type: 'array',
            items: { type: 'boolean' },
          },
          Parts: {
            type: 'array',
            items: { type: 'array' },
          },
          Date: {
            type: 'array',
            items: { type: 'string', format: 'date' },
          },
        },
      }
      const outputRaw = {
        Age: [131, 53, undefined, 8374, undefined],
        Date: ['1990-09-22', '1968-09-22', undefined, '2068-01-01', '1983-12-26'],
        Fingers: [
          '1,2,3,4,5,6,7,8,9,10',
          '1,2,3,4,5,6,7,8,9,10',
          '1,2,3,4,5,6,7,8,9,10',
          '1,2,3,4,5,6,7,8,9,10',
          '1,2,3,4,5,6,7,8,9,10',
        ],
        Male: [true, true, true, false, true],
        Name: ['Bilbo Baggins', 'Frodo Baggins', 'Sauron', 'Galadriel', 'Maxim'],
        Parts: [
          'head,legs,arms',
          'head,legs,arms',
          'head,legs,arms',
          'head,legs,arms',
          'head,legs,arms',
        ],
        Unlisted: 'yes',
      }
      const outputSchemed = {
        Age: [131, 53, undefined, 8374, undefined],
        Date: ['1990-09-22', '1968-09-22', undefined, '2068-01-01', '1983-12-26'],
        Fingers: [
          [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
          [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
          [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
          [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
          [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        ],
        Male: [true, true, true, false, true],
        Name: ['Bilbo Baggins', 'Frodo Baggins', 'Sauron', 'Galadriel', 'Maxim'],
        Parts: [
          ['head', 'legs', 'arms'],
          ['head', 'legs', 'arms'],
          ['head', 'legs', 'arms'],
          ['head', 'legs', 'arms'],
          ['head', 'legs', 'arms'],
        ],
        Unlisted: 'yes',
      }

      it('parses OpenOffice archive format', () => {
        const workbook = xlsx.readFile(path.resolve(__dirname, './mocks/hobbits.ods'), {
          cellDates: true,
          dateNF: 'yyyy-mm-dd',
        })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        expect(spreadsheets.parseSpreadsheetAgainstSchema(sheet)).toEqual(outputRaw)
        expect(spreadsheets.parseSpreadsheetAgainstSchema(sheet, hobbitsSchema)).toEqual(
          outputSchemed,
        )
      })

      it('parses CSV', () => {
        const workbook = xlsx.readFile(path.resolve(__dirname, './mocks/hobbits.csv'), {
          cellDates: true,
          dateNF: 'yyyy-mm-dd',
        })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        expect(spreadsheets.parseSpreadsheetAgainstSchema(sheet)).toEqual(outputRaw)
        expect(spreadsheets.parseSpreadsheetAgainstSchema(sheet, hobbitsSchema)).toEqual(
          outputSchemed,
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
