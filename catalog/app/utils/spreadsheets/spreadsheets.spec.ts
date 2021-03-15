import dedent from 'dedent'
import path from 'path'
import xlsx from 'xlsx'

import * as spreadsheets from './spreadsheets'

function readXlsx(filename: string): xlsx.WorkSheet {
  const workbook = xlsx.readFile(path.resolve(__dirname, filename), {
    cellDates: true,
  })
  return workbook.Sheets[workbook.SheetNames[0]]
}

describe('utils/spreadsheets', () => {
  describe('rowsToJson', () => {
    const rows = [
      ['a', 'b', 'c'],
      ['d', 'e,i,j,k', 'f'],
      ['g', 'h', null],
    ]

    it('converts rows array to dictionary object, array of cells', () => {
      expect(spreadsheets.rowsToJson(rows)).toEqual({
        a: ['b', 'c'],
        d: ['e,i,j,k', 'f'],
        g: ['h', null],
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
        g: ['h', null],
      })
    })
  })

  describe('scoreObjectDiff', () => {
    it('object with more keys in commont has bigger score', () => {
      const testA = { a: 1, b: 2, c: 3 }
      const testB = { c: 4, d: 5, e: 6 }
      const control = { b: 123, c: 456 }
      const scoreA = spreadsheets.scoreObjectDiff(testA, control)
      expect(scoreA).toBe(2)
      const scoreB = spreadsheets.scoreObjectDiff(testB, control)
      expect(scoreB).toBe(1)
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
        b: [1],
        c: [2],
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
        b: [1],
        c: [2],
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
        d: [1],
        e: [2],
        f: [3],
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
          Fingers: { type: 'array', items: { type: 'array' } },
          Male: { type: 'array', tems: { type: 'boolean' } },
          Parts: { type: 'array', items: { type: 'array' } },
        },
      }
      const outputRaw = {
        Age: [131],
        Date: ['1990-09-22'],
        Fingers: ['1,2,3,4,5,6,7,8,9,10'],
        Male: [true],
        Name: ['Bilbo Beggins'],
        Parts: ['head,legs,arms'],
      }
      const outputSchemed = {
        Age: [131],
        Date: ['1990-09-22'],
        Fingers: [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]],
        Male: [true],
        Name: ['Bilbo Beggins'],
        Parts: [['head', 'legs', 'arms']],
      }

      const testParsing = (filename: string) => {
        const sheet = readXlsx(filename)
        expect(spreadsheets.parseSpreadsheetAgainstSchema(sheet)).toEqual(outputRaw)
        expect(spreadsheets.parseSpreadsheetAgainstSchema(sheet, bilboSchema)).toEqual(
          outputSchemed,
        )
      }

      it('parses .ods', () => testParsing('./mocks/bilbo.ods'))
      it('parses .fods', () => testParsing('./mocks/bilbo.fods'))
      it('parses .csv', () => testParsing('./mocks/bilbo.csv'))
      it('parses .xls', () => testParsing('./mocks/bilbo.xls'))
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
        Age: [131, 53, null, 8374, null, { a: 123, b: 345 }],
        Date: ['1990-09-22', '1968-09-22', null, '2068-01-01', '1983-12-26', null],
        Fingers: [
          '1,2,3,4,5,6,7,8,9,10',
          '1,2,3,4,5,6,7,8,9,10',
          '1,2,3,4,5,6,7,8,9,10',
          '1,2,3,4,5,6,7,8,9,10',
          '1,2,3,4,5,6,7,8,9,10',
          null,
        ],
        Male: [true, true, true, false, true, null],
        Name: ['Bilbo Baggins', 'Frodo Baggins', 'Sauron', 'Galadriel', 'Maxim', null],
        Parts: [
          'head,legs,arms',
          'head,legs,arms',
          'head,legs,arms',
          'head,legs,arms',
          'head,legs,arms',
          null,
        ],
        Unlisted: ['yes', null, null, null, null, null],
        null: ['break it', null, null, null, null, null],
      }
      const outputSchemed = {
        Age: [131, 53, null, 8374, null, { a: 123, b: 345 }],
        Date: ['1990-09-22', '1968-09-22', null, '2068-01-01', '1983-12-26', null],
        Fingers: [
          [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
          [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
          [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
          [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
          [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
          null,
        ],
        Male: [true, true, true, false, true, null],
        Name: ['Bilbo Baggins', 'Frodo Baggins', 'Sauron', 'Galadriel', 'Maxim', null],
        Parts: [
          ['head', 'legs', 'arms'],
          ['head', 'legs', 'arms'],
          ['head', 'legs', 'arms'],
          ['head', 'legs', 'arms'],
          ['head', 'legs', 'arms'],
          null,
        ],
        Unlisted: ['yes', null, null, null, null, null],
        null: ['break it', null, null, null, null, null],
      }

      const testParsing = (filename: string) => {
        const sheet = readXlsx(filename)
        expect(spreadsheets.parseSpreadsheetAgainstSchema(sheet)).toEqual(outputRaw)
        expect(spreadsheets.parseSpreadsheetAgainstSchema(sheet, hobbitsSchema)).toEqual(
          outputSchemed,
        )
      }

      const testParsingTransposed = (filename: string) => {
        const sheet = readXlsx(filename)
        expect(spreadsheets.parseSpreadsheetAgainstSchema(sheet, hobbitsSchema)).toEqual(
          outputSchemed,
        )
      }

      it('parses .ods', () => testParsing('./mocks/hobbits.ods'))
      it('parses .csv', () => testParsing('./mocks/hobbits.csv'))

      it('parses transposed .ods', () =>
        testParsingTransposed('./mocks/hobbits-horizontal.ods'))
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
