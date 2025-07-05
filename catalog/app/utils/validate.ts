export function oneOf<T extends string, L extends T[]>(
  comparisonList: L,
  subject: T,
): subject is (typeof comparisonList)[number] {
  return comparisonList.some((compare) => compare === subject)
}
