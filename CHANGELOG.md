# ventyd

## 1.15.1

### Patch Changes

- bd3a09b: fix: prisma adapter default export -> named export

## 1.15.0

### Minor Changes

- b6e27da: feat: prisma adapter (undocumented)

## 1.14.0

### Minor Changes

- aca4c86: feat: support `typebox` v1 (remove `@sinclair/typebox`, `@sinclair/typemap`)

## 1.13.0

### Minor Changes

- f75c96c: refactor: remove `subscribe()` API

### Patch Changes

- eacf012: Add more descriptive validation error messages
- 69a6b61: docs: add logo in README.md
- 8866d16: refactor: improve " $$flush"

## 1.12.1

### Patch Changes

- af4d59a: fix: type

## 1.12.0

### Minor Changes

- 0b13e84: feat: add ` $$now` method to Entity for consistent timestamp generation

## 1.11.0

### Minor Changes

- 7bc8989: feat: add state change subscription functionality to entities

## 1.10.1

### Patch Changes

- 2dfde36: fix: update unknown types

## 1.10.0

### Minor Changes

- 7e7a1ae: feat: `UNSAFE_mutable` in `Entity.load()`

## 1.9.1

### Patch Changes

- 8b6170c: chore: transfer ownership to `daangn`

## 1.9.0

### Minor Changes

- 4ebb477: feat: support typebox
- f20c92a: feat: support zod, arktype

## 1.8.0

### Minor Changes

- cedfe6b: feat: add standard schema support

## 1.7.1

### Patch Changes

- 75763f1: refactor: improve type handling in Entity and mutation functions

## 1.7.0

### Minor Changes

- a6ed709: feat: can use ventyd regardless of schema library.
- 7cfc8e3: feat: enhance CQRS feature with `mutation` helper function

## 1.6.0

### Minor Changes

- b70cefb: feat: add plugin support

## 1.5.0

### Minor Changes

- 9e0fa56: feat: add namespace separater option

## 1.4.2

### Patch Changes

- 5e35c78: fix: bug `eventCreatedAt` options not working

## 1.4.1

### Patch Changes

- f1fd11d: feat: add `eventId`, `eventCreatedAt` option in `dispatch()`

## 1.4.0

### Minor Changes

- 8308be0: fix: change name storage -> adapter. and remove `defineStorage()` function

## 1.3.0

### Minor Changes

- 092ad6c: feat: readonly model and create instance with static method not constructor (`Entity.create()`, `Entity.load()`)

## 1.2.0

### Minor Changes

- 291dc02: feat: support snapshot feature (can commit snapshot and can initialize entity with state)

## 1.1.1

### Patch Changes

- 556ba27: fix: export `EntityConstructor` interface

## 1.1.0

### Minor Changes

- d921917: feat: replace `zod` to `valibot`

## 1.0.2

### Patch Changes

- 2bf6883: refactor: types

## 1.0.1

### Patch Changes

- d217760: fix package.json
