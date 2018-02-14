# Checks (Beta)
Checks are data integrity tests that are defined in `build.yml`

## Syntax
- Checks are defined in a top-level dictionary called `checks:`
- `qc.data` is an automatic variable that contains the node's data in pandas data frame
- The full pandas expression syntax is supported 
- Standard Python can be inlined with YAML's `|` operator (see below)


## Functions (`qc.*`)
| Signature | Description |
|---|---|
| `check(COND)` | Check `COND == true` |
| `check_column_enum(COL_REGEX, EXPR)` | Check `set(LIST) == set(MATCHING_COLUMNS)` |
| `print_recnums(COL_REGEX, EXPR)` | Print line numbers of rows that match `EXPR`. |
| `check_column_valrange(COL_REGEX, minval=None, maxval=None, lambda_or_name=None)` | Check that column values fall within [`minval`, `maxval`]. `lambda_or_name` is either a lambda expression applied to the matching column(s) or one of `'abs', 'count', 'mean', 'median', 'mode', 'stddev', or 'sum` |
| `check_column_regexp(COL_REGEX, REGEX)` | Check that all column values match `REGEX` |
| `check_column_substr(COL_REGEX, SUBSTR)` | Check that all column values contain substing `SUBSTR` |
| ~~`check_column_datetime(COL_REGEX, FORMAT)`~~ | Not yet supported. Check that all column datetimes conform to [`FORMAT`](https://docs.python.org/2/library/datetime.html#strftime-and-strptime-behavior) |

>  `EXPR` can be a lambda (in which case it's called back with the matching column(s)), or a list of literals


## Example
Source data: [sales.xls](https://drive.google.com/open?id=1MUP-_dV8hzdn2khMQgOjWFoO9RMBmBCk) from [Tableau Community](https://community.tableau.com/docs/DOC-1236)

```yaml
contents:
  transactions:
    file: sales.xls
    transform: xls
    checks: cardinality labels stats range price dates

checks:
  cardinality: |
    # verify column cardinality
    symbols = qc.data['Order Priority'].nunique()
    qc.check(symbols == 5)
  labels: |
    qc.check_column_enum(r'Order Priority', ['Low', 'High', 'Medium', 'Not Specified', 'Critical'])
    qc.print_recnums("Critical orders",  qc.data['Order Priority'] == 'Critical')
  stats: |
    # standard deviation
    sd_sales = qc.data['Sales'].std()
    qc.check(sd_sales < 3586)
  range: |
    # ensure average discount is no more than 20%
    qc.check_column_valrange('Discount', maxval=0.2, lambda_or_name='avg')
  price: |
    # check that prices are formatted properly
    qc.check_column_regexp('Unit Price','\d+\.\d+')
```