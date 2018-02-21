export const mkValidator = (name, test) => (v) => v && !test(v) ? name : undefined;

export const matches = (re) => (str) => re.test(str);

export const required = (v) => v ? undefined : 'required';
