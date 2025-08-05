import { Effect, pipe, Console, Data } from "effect";

// Define custom error types with Data
class NotFoundError extends Data.TaggedError("NotFoundError")<{
  readonly id: string;
}> {}

class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly field: string;
  readonly message: string;
}> {}

class DatabaseError extends Data.TaggedError("DatabaseError")<{
  readonly query: string;
  readonly cause: unknown;
}> {}

// User type for our example
interface User {
  id: string;
  name: string;
  email: string;
}

// Simulated database functions
const findUser = (
  id: string
): Effect.Effect<User, NotFoundError | DatabaseError> => {
  if (id === "invalid-id") {
    return Effect.fail(new NotFoundError({ id }));
  }
  if (id === "db-error") {
    return Effect.fail(
      new DatabaseError({ 
        query: `SELECT * FROM users WHERE id = '${id}'`, 
        cause: "Connection lost" 
      })
    );
  }
  return Effect.succeed({
    id,
    name: "John Doe",
    email: "john@example.com",
  });
};

const validateEmail = (
  email: string
): Effect.Effect<string, ValidationError> => {
  if (!email.includes("@")) {
    return Effect.fail(
      new ValidationError({ field: "email", message: "Invalid email format" })
    );
  }
  return Effect.succeed(email);
};

const updateUserEmail = (
  userId: string,
  newEmail: string
): Effect.Effect<
  User,
  NotFoundError | ValidationError | DatabaseError
> => {
  return pipe(
    // Find the user
    findUser(userId),
    // Validate the new email
    Effect.flatMap((user) =>
      pipe(
        validateEmail(newEmail),
        Effect.map((validatedEmail) => ({
          ...user,
          email: validatedEmail,
        }))
      )
    )
  );
};

// Type-specific error handling
const handleUpdateError = <R, E, A>(
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A | string, never, R> => {
  return pipe(
    effect,
    Effect.catchTags({
      NotFoundError: (error) =>
        Effect.succeed(`User with ID ${error.id} not found`),
      ValidationError: (error) =>
        Effect.succeed(`Validation failed: ${error.field} - ${error.message}`),
      DatabaseError: (error) =>
        Effect.succeed(`Database error in query "${error.query}": ${error.cause}`)
    })
  );
};

// Example of running with different scenarios
const runTypedErrorExamples = async () => {
  // Successful case
  const result1 = await Effect.runPromise(
    pipe(
      updateUserEmail("valid-id", "new-email@example.com"),
      handleUpdateError,
      Effect.tap((result) => Console.log("Result 1:", result))
    )
  );

  // Not found error
  const result2 = await Effect.runPromise(
    pipe(
      updateUserEmail("invalid-id", "new-email@example.com"),
      handleUpdateError,
      Effect.tap((result) => Console.log("Result 2:", result))
    )
  );

  // Validation error
  const result3 = await Effect.runPromise(
    pipe(
      updateUserEmail("valid-id", "invalid-email"),
      handleUpdateError,
      Effect.tap((result) => Console.log("Result 3:", result))
    )
  );

  // Database error
  const result4 = await Effect.runPromise(
    pipe(
      updateUserEmail("db-error", "new-email@example.com"),
      handleUpdateError,
      Effect.tap((result) => Console.log("Result 4:", result))
    )
  );
};

// Call this to run the examples
// runTypedErrorExamples().catch(console.error);

export {
  NotFoundError,
  ValidationError,
  DatabaseError,
  findUser,
  validateEmail,
  updateUserEmail,
  handleUpdateError,
  runTypedErrorExamples,
};
