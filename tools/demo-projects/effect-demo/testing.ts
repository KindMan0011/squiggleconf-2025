import { Effect, pipe, Console, Context } from "effect";
import {
  LoggerService,
  UserRepositoryService,
  EmailServiceTag,
  createUserService,
} from "./dependency-injection";

// Mock implementations for testing
const testLogger = {
  log: (message: string) => Effect.succeed(undefined),
  error: (message: string, error?: unknown) => Effect.succeed(undefined),
};

const createTestUserRepository = (initialUsers: Record<string, any> = {}) => {
  const users = new Map(Object.entries(initialUsers));
  const saveLog: any[] = [];

  return {
    repository: {
      findById: (id: string) =>
        Effect.succeed(users.has(id) ? users.get(id) : null),
      save: (user: any) =>
        Effect.sync(() => {
          users.set(user.id, user);
          saveLog.push(user);
          return user;
        }),
    },
    // Test helpers
    getSaveLog: () => [...saveLog],
    getUsers: () => new Map(users),
  };
};

const createTestEmailService = () => {
  const sentEmails: any[] = [];

  return {
    service: {
      sendWelcomeEmail: (user: any) =>
        Effect.sync(() => {
          sentEmails.push({ type: "welcome", user });
        }),
    },
    // Test helpers
    getSentEmails: () => [...sentEmails],
  };
};

// Example test function
const testUserRegistration = async () => {
  // Set up test dependencies
  const { repository: userRepo, getSaveLog } = createTestUserRepository();
  const { service: emailService, getSentEmails } = createTestEmailService();

  // Create the service to test
  const { registerUser } = createUserService();

  // Create a test environment with mock dependencies
  const testEnvironment = pipe(
    Effect.provide(LoggerService.of(testLogger)),
    Effect.provide(UserRepositoryService.of(userRepo)),
    Effect.provide(EmailServiceTag.of(emailService))
  );

  // Define the test case
  const testCase = Effect.gen(function* (_) {
    // Given a name and email
    const name = "Test User";
    const email = "test@example.com";

    // When registering a user
    const user = yield* _(registerUser(name, email));

    // Then the user should be saved
    const savedUsers = getSaveLog();
    console.log("User was saved:", savedUsers.length === 1);
    console.log("User has correct data:", user.name === name && user.email === email);

    // And a welcome email should be sent
    const sentEmails = getSentEmails();
    console.log("Welcome email was sent:", sentEmails.length === 1);
    console.log(
      "Email sent to correct user:",
      sentEmails[0]?.user?.id === user.id
    );

    return { user, savedUsers, sentEmails };
  });

  // Run the test with the test environment
  const result = await Effect.runPromise(testEnvironment(testCase));
  console.log("Test completed successfully");
  return result;
};

// Call this to run the test
// testUserRegistration().catch(console.error);

export { testLogger, createTestUserRepository, createTestEmailService, testUserRegistration };
