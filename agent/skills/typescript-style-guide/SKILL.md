---
name: typescript-style-guide
description: A comprehensive TypeScript style guide. Use when writing or reviewing TypeScript code.
---

# TypeScript Style Guide

## Core Principles

### 1. Algebraic Data Types

All domains can be represented using two constructs:

- **Product Types** (AND) - Represented using TypeScript objects
- **Sum Types** (OR) - Represented using TypeScript unions

### 2. Discriminated Unions

Always use discriminated unions with a `type` field to enable proper type narrowing:

```typescript
type Product =
  | { type: "SimpleProduct"; id: number; description: string; price: number }
  | {
      type: "ProductWithOptions";
      id: number;
      description: string;
      prices: Array<number>;
    }
  | {
      type: "Kit";
      id: number;
      description: string;
      price: number;
      children: Array<{
        id: number;
        description: string;
        price: number;
        isRequired: boolean;
      }>;
    };
```

### 3. Exhaustiveness Checking

Always use `never` and `assertUnreachable` to ensure all cases are handled:

```typescript
function assertUnreachable(x: never, errorMessage: string): never {
  throw new Error(errorMessage);
}
```

### 4. Making Impossible States Impossible

Use algebraic data types to prevent invalid states from being representable in your type system.

## Style Rules

### ✅ DO

**Enforce immutability with `readonly`**

Use `readonly` for object properties and `ReadonlyArray<T>` (or `readonly T[]`) for array types to ensure data structures are immutable.

```typescript
type User = {
  readonly id: number;
  readonly name: string;
  readonly tags: ReadonlyArray<string>; // or readonly string[]
};

const user: User = { id: 1, name: "Alice", tags: ["admin", "editor"] };
// user.id = 2; // TS Error - Correct!
// user.tags.push("new"); // TS Error - Correct!
```

**Use Zod schemas for runtime type validation instead of `unknown`**

When dealing with runtime data (e.g., API responses, user input), prefer Zod for validation and type inference:

```typescript
import { z } from "zod";

// Good - Define a schema and use it for validation
const UserDataSchema = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
});

const rawData = fetchData();
const data = UserDataSchema.parse(rawData); // data is now typed and validated
```

Use `unknown` only when you truly don't know the type and can't define a schema. Prefer Zod because it:

- Validates data at runtime
- Provides better error messages
- Infers types automatically with `.infer()`
- Handles complex validation logic (emails, dates, custom rules)

```typescript
// Bad - No validation, just type annotation
const data: unknown = fetchData();
```

**Use optional chaining (`?.`) and nullish coalescing (`??`)**

These operators provide safe and concise ways to handle potentially null or undefined values.

```typescript
// Good
const street = user?.address?.street ?? "N/A";

// Bad - verbose null checks
const streetOld = user && user.address && user.address.street ? user.address.street : "N/A";
```

**Prefer unions over enums**

```typescript
// Good
const serviceTypes = ["ASSEMBLY", "INSTALLATION", "HAULAWAY"] as const;
type ServiceTypes = (typeof serviceTypes)[number];

// Bad
enum ServiceTypes {
  ASSEMBLY_EXPERIENCE_TYPE = "ASSEMBLY",
  INSTALLATION_EXPERIENCE_TYPE = "INSTALLATION",
  HAULAWAY_EXPERIENCE_TYPE = "HAULAWAY",
}
```

**Use errors as values instead of throwing errors**

```typescript
type Result<T> =
  | { type: "success"; value: T }
  | { type: "failure"; error: string };
```

**Prefer `type` over `interface`**

```typescript
// Good - Composition
type ProductWithOptions = Product & { options: Array<Product> };

// Bad - Inheritance
interface ProductWithOptions extends Product {
  options: Array<Product>;
}
```

**Use generated types**
Use generated types via GraphQL codegen or OpenAPI specs whenever possible.

**Enable strict TypeScript settings**

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitReturns": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "skipLibCheck": true,
    "noUncheckedIndexedAccess": true
  }
}
```

### ❌ DON'T

**Avoid the `any` keyword**

Using `any` disables type checking and should be avoided. If a type is truly unknown, consider using `unknown` and a Zod schema for validation, or provide a clear justification with a comment.

```typescript
// Bad
function processData(data: any) { /* ... */ }

// Good - Use unknown with validation
function processData(data: unknown) {
  const validatedData = UserDataSchema.parse(data);
  // ...
}

// Acceptable - with justification
// declare const customGlobalLib: any; // External library with no types
```

**Avoid type casting (using `as` keyword)**

```typescript
// Bad
const x = {} as MyObject;

// Good
const y: MyObject = {}; // TS error - correct!
```

**Avoid `@ts-ignore` comments**
These disable type checking and create dangerous code areas.

**Don't throw errors for control flow**
Use error values instead for more predictable code.

**Don't redefine existing types**

Prefer to reuse generated types (e.g., from GraphQL or OpenAPI) or existing types within the project. If a type is truly new and not covered by existing definitions, define it clearly. Avoid creating redundant types that already exist elsewhere.

**Don't use branded types unnecessarily**
TypeScript's structural typing means branded types require casting and can be confusing.

## Naming Conventions

-   **Types and Interfaces:** Use `PascalCase`, and perfer using types over interfaces.
-   **Variables and Functions:** Use `camelCase` (e.g., `const userName`, `function calculateTotal`).
-   **Constants (Global):** Use `SCREAMING_SNAKE_CASE` (e.g., `const API_KEY`, `const DEFAULT_TIMEOUT`).
-   **Enums:** Do not use enums. Prefer discriminated unions instead. We adhere to the `erasableSyntaxOnly` paradigm.

## TypeScript Configuration

### tsconfig.json Recommendations

- Enable strict mode (`"strict": true`)
- Require explicit returns (`"noImplicitReturns": true`)
- Avoid implicit any (`"noImplicitAny": true`)
- Have strict null checks (`"strictNullChecks": true`)
- Skip type checking node_modules (`"skipLibCheck": true`) - **Note:** This setting can hide type issues from third-party libraries.
- Force array access to check for undefined (`"noUncheckedIndexedAccess": true`)

## Testing and Types

- Types and tests both evolve with domains
- Make invalid states unrepresentable to reduce needed tests
- Automated tests should focus on user flows and business logic
- Types should educate developers about domains

## Focus on Clarity

- Prioritize clear, domain-educating type definitions
- Avoid complex types that obscure domains
- Don't try to "lock down code" - TypeScript has escape hatches
- Reach for tests instead of clever type system workarounds

## Additional Resources

- [Zod Documentation](https://zod.dev/) - Runtime type validation for TypeScript
- [TypeScript Utility Types](https://www.typescriptlang.org/docs/handbook/utility-types.html)
