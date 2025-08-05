import { Effect, Console, pipe } from "effect";

// A simple effect that always succeeds
const helloWorld = Effect.succeed("Hello, World!");

// An effect that might fail
const mayFail = (shouldFail: boolean): Effect.Effect<string, Error> =>
  shouldFail
    ? Effect.fail(new Error("Something went wrong"))
    : Effect.succeed("Operation succeeded");

// Running effects
const runBasicExamples = async () => {
  // Run a successful effect
  const result1 = await Effect.runPromise(helloWorld);
  console.log("Result 1:", result1);

  // Run a failing effect and handle errors
  const result2 = await Effect.runPromise(
    pipe(
      mayFail(true),
      Effect.catchAll((error) => Effect.succeed(`Caught error: ${error.message}`))
    )
  );
  console.log("Result 2:", result2);

  // Chain multiple effects
  const combined = pipe(
    Effect.succeed(10),
    Effect.map((n) => n * 2),
    Effect.flatMap((n) => Effect.succeed(`The number is ${n}`)),
    Effect.tap((message) => Console.log(message))
  );

  await Effect.runPromise(combined);
};

// Call this to run the examples
// runBasicExamples().catch(console.error);

export { helloWorld, mayFail, runBasicExamples };
