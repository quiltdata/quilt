export const branch = (subj, cases) => subj in cases && cases[subj]();

export const formatActivity = (map, activity) =>
  map
    .filter((key) => key in activity)
    .map((key) => `${activity[key]} ${key}`)
    .join(', ');

export const formatDate = (d) => d ? new Date(d).toLocaleString() : 'N/A';
