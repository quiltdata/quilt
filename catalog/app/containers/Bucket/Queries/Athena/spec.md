# Athena State Management Specification

## State Types

See type definitions in [`model/utils.ts`](model/utils.ts) and [`model/state.tsx`](model/state.tsx).

```typescript
type Data<T> = T | undefined | typeof Loading | Error
type Value<T> = T | undefined | typeof Loading | Error | null

interface DataController<T> {
  data: Data<T>
  loadMore: () => void
}

interface ValueController<T> {
  value: Value<T>
  setValue: (v: T | null) => void
}
```

**`Data<T>`** - System data from external sources (APIs). Cannot be `null`.
**`Value<T>`** - User selections and choices. Can be `null` when user deselects.

**DataController** - Manages loading operations, handles `Loading`/`Error` states.
**ValueController** - Manages user selections, cannot set `Loading`/`Error` directly.

## XML User Stories

### Story 1: View Execution Results

```ts
const { bucket, workgroupId, executionId } = useURLParams()
```

```xml
<Athena :bucket :workgroupId :executionId>
  <execution polling>
    <workgroups>
      <workgroup select=":workgroupId">
        <queries>
          <query select="execution.query">
            <queryBody readonly select="execution.query" />
          </query>
        </queries>
        <catalogNames>
          <catalogName select="execution.catalogName">
            <databases>
              <database select="execution.database" />
            </databases>
          </catalogName>
        </catalogNames>
      </workgroup>
    </workgroups>
    <results />
  </execution>
</Athena>
```

### Story 2: Main Query Interface

```ts
const { bucket, workgroupId } = useURLParams()
```

```xml
<Athena :bucket :workgroupId>
  <workgroups>
    <workgroup select=":workgroupId">
      <queries>
        <query user-selectable>
          <queryBody editable />
        </query>
      </queries>
      <catalogNames>
        <catalogName user-selectable storage-fallback>
          <databases>
            <database user-selectable storage-fallback />
          </databases>
        </catalogName>
      </catalogNames>
      <executions />
    </workgroup>
  </workgroups>
  <queryRun ready />
</Athena>
```

### Story 3: Landing Page (No Workgroup Selected)

```ts
const { bucket } = useURLParams()
```

```xml
<Athena :bucket>
  <workgroups>
    <navigate to=":defaultWorkgroupId" />
  </workgroups>
</Athena>
```

### Story 4: User Selects Different Workgroup

```ts
const { bucket, workgroupId } = useURLParams()
```

```xml
<Athena :bucket :workgroupId>
  <workgroups>
    <navigate to=":selectedWorkgroupId" />
  </workgroups>
</Athena>
```

### Story 5: User Edits Query Text

```ts
const { bucket, workgroupId } = useURLParams()
```

```xml
<Athena :bucket :workgroupId>
  <workgroups>
    <workgroup select=":workgroupId">
      <queries>
        <query deselected>
          <queryBody custom-user-input />
        </query>
      </queries>
      <catalogNames>
        <catalogName preserved>
          <databases>
            <database preserved />
          </databases>
        </catalogName>
      </catalogNames>
    </workgroup>
  </workgroups>
  <queryRun ready />
</Athena>
```

### Story 6: User Submits Query

```ts
const { bucket, workgroupId } = useURLParams()
```

```xml
<Athena :bucket :workgroupId>
  <workgroups>
    <workgroup select=":workgroupId">
      <queries>
        <query disabled preserves-query>
          <queryBody readonly preserves-user-input />
        </query>
      </queries>
      <catalogNames>
        <catalogName disabled>
          <databases>
            <database disabled />
          </databases>
        </catalogName>
      </catalogNames>
    </workgroup>
  </workgroups>
  <queryRun loading>
    <navigate to=":executionId" on-success />
  </queryRun>
</Athena>
```
