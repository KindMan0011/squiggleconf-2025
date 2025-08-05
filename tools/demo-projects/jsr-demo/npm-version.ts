// npm version (package.json + node_modules)
import { z } from 'zod';

const User = z.object({
  id: z.number(),
  name: z.string(),
  email: z.string().email(),
  age: z.number().optional(),
});

type User = z.infer<typeof User>;

function validateUser(data: unknown): User {
  return User.parse(data);
}

// Example usage
try {
  const validUser = validateUser({
    id: 1,
    name: 'John Doe',
    email: 'john@example.com',
    age: 30,
  });
  console.log('Valid user:', validUser);
  
  const invalidUser = validateUser({
    id: 'not-a-number',
    name: 123,
    email: 'not-an-email',
  });
} catch (error) {
  console.error('Validation error:', error);
}
