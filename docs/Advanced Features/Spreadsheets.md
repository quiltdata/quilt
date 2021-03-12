User can drag'n'drop spreadsheets into metadata. Supported formats are csv, ods, fods, xls, xlsx, xlsm

If spreadsheet has this data:

| keyA     | keyB     | keyC     |
|----------|----------|----------|
| valueA_1 | valueB_1 | valueC_1 |
| valueA_2 | valueB_2 | valueC_2 |
| valueA_3 | valueB_3 | valueC_3 |

It will be converted to JSON:

```json
{
  "keyA": ["valueA_1", "valueA_2", "valueA_3"],
  "keyB": ["valueB_1", "valueB_2", "valueB_3"],
  "keyC": ["valueC_1", "valueC_2", "valueC_3"]
}
```

Spreadsheets may have horizontal data direction:

| keyA | valueA_1 | valueA_2 | valueA_3 |
|------|----------|----------|----------|
| keyB | valueB_1 | valueB_2 | valueB_3 |
| keyC | valueC_1 | valueC_2 | valueC_3 |

Schema is mandatory to convert this data to JSON:

```json
{
  "type": "object",
  "properties": {
    "keyA": {
      "type": "array"
    }
  }
}
```

Quilt will try to guess table orientation by analazyng Schema.

Table may have empty cells. They will be replaced by null in resulting JSON.

Tables may contain strings, numbers, booleans and dates. Dates will be converted into YYYY-MM-DD format. If JSON Schema has `{ type: "array" }` for cell, quilt will convert this string to array, splitting items by coma. Also quilt will try to parse strings as JSON, string `"{"a": 1, "b", 2}"` in spreadsheet's cell will become real object in resulting JSON.
