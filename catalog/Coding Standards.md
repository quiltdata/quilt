# Catalog Coding Standards

## Rules

### Code formatting

* Use `prettier`. Config set at `.prettierrc.json`

* Sort imports alphabetically case-insensitive by module's basename

* Prefer wildcard-imports over destructuring imports

### Unit-tests

  * Main test unit is a function. `Describe` test for a function

  * One test for one assertion

  * `it` should have form according to `it("should return something when circumstances")`

## Recomendations

* Use `ESLint`. Config set at `.eslintrc.js`
