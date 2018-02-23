/* String utils */
import config from 'constants/config';

export function makeHandle(owner, pkg) {
  return config.team ? `${config.team.name}:${owner}/${pkg}` : `${owner}/${pkg}`;
}

export function makeMatcher(exp, flags = 'i') {
  const re = new RegExp(exp, flags);
  return (s) => re.test(s);
}

export function printObject(obj) {
  return JSON.stringify(obj, null, '  ');
}
