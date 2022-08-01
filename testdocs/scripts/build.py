import requests
import io
from collections import Counter
import pandas as pd
import numpy as np


atlantic_raw = requests.get(
    "https://www.nhc.noaa.gov/data/hurdat/hurdat2-1851-2017-050118.txt"
)
atlantic_raw.raise_for_status()  # check that we actually got something back

c = Counter()
for line in io.StringIO(atlantic_raw.text).readlines():
    c[line[:2]] += 1

atlantic_storms_r = []
atlantic_storm_r = {'header': None, 'data': []}

for i, line in enumerate(io.StringIO(atlantic_raw.text).readlines()):
    if line[:2] == 'AL':
        atlantic_storms_r.append(atlantic_storm_r.copy())
        atlantic_storm_r['header'] = line
        atlantic_storm_r['data'] = []
    else:
        atlantic_storm_r['data'].append(line)

atlantic_storms_r = atlantic_storms_r[1:]

atlantic_storm_dfs = []
for storm_dict in atlantic_storms_r:
    storm_id, storm_name, storm_entries_n = storm_dict['header'].split(",")[:3]
    data = [[entry.strip() for entry in datum[:-1].split(",")] for datum in storm_dict['data']]
    frame = pd.DataFrame(data)
    frame['id'] = storm_id
    frame['name'] = storm_name
    atlantic_storm_dfs.append(frame)

atlantic_storms = pd.concat(atlantic_storm_dfs)
atlantic_storms = atlantic_storms.reindex(columns=atlantic_storms.columns[-2:] | atlantic_storms.columns[:-2])

# Assign columns from the metadata.
atlantic_storms.columns = [
        "id",
        "name",
        "date",
        "hours_minutes",
        "record_identifier",
        "status_of_system",
        "latitude",
        "longitude",
        "maximum_sustained_wind_knots",
        "maximum_pressure",
        "34_kt_ne",
        "34_kt_se",
        "34_kt_sw",
        "34_kt_nw",
        "50_kt_ne",
        "50_kt_se",
        "50_kt_sw",
        "50_kt_nw",
        "64_kt_ne",
        "64_kt_se",
        "64_kt_sw",
        "64_kt_nw",
        "na"
]

# Replace sentinal values with true NAs.
del atlantic_storms['na']
atlantic_storms = atlantic_storms.replace(to_replace='-999', value=np.nan)
atlantic_storms = atlantic_storms.replace(to_replace="", value=np.nan)

# Fix date and location columns.
atlantic_storms['latitude'] = atlantic_storms['latitude']\
    .map(lambda lat: lat[:-1] if lat[-1] == "N" else -lat[:-1])
atlantic_storms['longitude'] = atlantic_storms['longitude']\
    .map(lambda long: long[:-1] if long[-1] == "E" else "-" + long[:-1])
atlantic_storms['date'] = pd.to_datetime(atlantic_storms['date'])
atlantic_storms['date'] = atlantic_storms\
    .apply(
        lambda srs: srs['date'].replace(hour=int(srs['hours_minutes'][:2]), minute=int(srs['hours_minutes'][2:])),
        axis='columns'
    )

# Remove unused column.
del atlantic_storms['hours_minutes']

# Strip out spaces padding out names.
atlantic_storms['name'] = atlantic_storms['name'].map(lambda n: n.strip())

# Reindex.
atlantic_storms.index = range(len(atlantic_storms.index))
atlantic_storms.index.name = "index"

# Save to local disk
atlantic_storms.to_csv("../data/atlantic-storms.csv", index=False)
