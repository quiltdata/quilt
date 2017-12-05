/* String utils */
export function makeMatcher(exp, flags = 'i') {
  const re = new RegExp(exp, flags);
  return (s) => re.test(s);
}

export function printObject(obj) {
  return JSON.stringify(obj, null, '  ');
}
