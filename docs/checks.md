# Checks (beta)
Checks are data integrity tests that are defined in `build.yml`

## Syntax
- Checks are defined in a top-level dictionary called `checks:`
- 

## Example
```yaml
contents:
  sales:
    file: sales.xls
    transform: xls
    checks: cardinality labels stats

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
```