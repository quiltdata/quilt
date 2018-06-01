# Checks (ALPHA)
Checks are data integrity tests that are defined in `build.yml`. They are run at package build time to ensure that all consumers of the data package only receive data that comply to the given checks.

Checks can be used to prevent model drift and data deployment errors that result from using data that do not fit an expected profile.

## Known issues
- [ ] support data that are larger than a pandas data frame (1GB to 10GB)
- [ ] display progress bars during checks process
- [ ] print offending line number when a check fails
- [ ] allow package users (other than the owner) to see checks and `build.yml` source

## Syntax
- Checks are defined in a top-level dictionary called `checks:`
- `qc.data` is an automatic variable that contains the node's data in pandas data frame
- The full pandas expression syntax is supported 
- Standard Python can be inlined with YAML's `|` operator (see below)

## Functions (`qc.*`)
| Signature | Description |
|---|---|
| `check(COND)` | Check that `COND == true` |
| `check_column_enum(COL_REGEX, LIST_OR_LAMBDA)` | Checks that all column values are in the list (and vice versa), or calls a lambda on the column |
| `print_recnums(COL_REGEX, EXPR)` | Print line numbers of rows that match `EXPR`. |
| `check_column_valrange(COL_REGEX, minval=None, maxval=None, lambda_or_name=None)` | Check that column values fall within [`minval`, `maxval`]. `lambda_or_name` is either a lambda expression applied to the matching column(s) or one of `'abs', 'count', 'mean', 'median', 'mode', 'stddev', or 'sum` |
| `check_column_regexp(COL_REGEX, REGEX)` | Check that all column values match `REGEX` |
| `check_column_substr(COL_REGEX, SUBSTR)` | Check that all column values contain substing `SUBSTR` |
| ~~`check_column_datetime(COL_REGEX, FORMAT)`~~ | Not yet supported. Check that all column datetimes conform to [`FORMAT`](https://docs.python.org/2/library/datetime.html#strftime-and-strptime-behavior) |

> `COL_REGEX` is a string literal or regular expression that matches one or more columns; the corresponding check is applied to each matching column


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
    stdev = qc.data['Sales'].std()
    qc.check(stdev < 3586)
  range: |
    # ensure average discount is no more than 20%
    qc.check_column_valrange('Discount', maxval=0.2, lambda_or_name='avg')
  price: |
    # check that prices are formatted properly
    qc.check_column_regexp('Unit Price','\d+\.\d+')
```
