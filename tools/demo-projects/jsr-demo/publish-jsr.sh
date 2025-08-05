#!/bin/bash

# Example script showing JSR publishing workflow

# Check for JSR CLI
if ! command -v jsr &> /dev/null; then
  echo "JSR CLI not found. Installing..."
  deno install -A -r https://jsr.io/jsr.js
fi

# Create a new JSR package
echo "Creating a new JSR package..."
mkdir -p my-jsr-package
cd my-jsr-package

# Initialize JSR package
echo "Initializing JSR package..."
jsr init

# Create main module file
cat > mod.ts << EOF
/**
 * My JSR Package
 * A simple utility library
 */

/**
 * Adds two numbers together
 */
export function add(a: number, b: number): number {
  return a + b;
}

/**
 * Subtracts one number from another
 */
export function subtract(a: number, b: number): number {
  return a - b;
}

/**
 * Formats a string with provided values
 */
export function format(template: string, values: Record<string, string>): string {
  return template.replace(/\${(\w+)}/g, (_, key) => values[key] || '');
}
EOF

# Create a test file
mkdir -p tests
cat > tests/mod_test.ts << EOF
import { add, subtract, format } from "../mod.ts";
import { assertEquals } from "@std/assert";

Deno.test("add works", () => {
  assertEquals(add(1, 2), 3);
});

Deno.test("subtract works", () => {
  assertEquals(subtract(5, 2), 3);
});

Deno.test("format works", () => {
  assertEquals(
    format("Hello, \${name}!", { name: "World" }),
    "Hello, World!"
  );
});
EOF

# Create a README
cat > README.md << EOF
# My JSR Package

A simple utility library published to JSR.

## Installation

```ts
// Import in Deno, Node.js, Bun, or browsers
import { add, subtract, format } from "@username/my-jsr-package";
```

## Usage

```ts
// Basic math
add(1, 2); // 3
subtract(5, 2); // 3

// String formatting
format("Hello, \${name}!", { name: "World" }); // "Hello, World!"
```
EOF

echo "Package created successfully!"
echo "To publish, run: jsr publish"
echo "Note: You need to be logged in with jsr login first"
