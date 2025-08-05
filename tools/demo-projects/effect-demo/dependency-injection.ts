import { Effect, Context, pipe, Console } from "effect";

// 1. Define service interfaces
interface Logger {
  readonly log: (message: string) => Effect.Effect<void>;
  readonly error: (message: string, error?: unknown) => Effect.Effect<void>;
}

interface UserRepository {
  readonly findById: (id: string) => Effect.Effect<User | null>;
  readonly save: (user: User) => Effect.Effect<User>;
}

interface EmailService {
  readonly sendWelcomeEmail: (user: User) => Effect.Effect<void>;
}

// User model
interface User {
  id: string;
  name: string;
  email: string;
}

// 2. Create Context tags for each service
class LoggerService extends Context.Tag("LoggerService")<
  LoggerService,
  Logger
>() {}

class UserRepositoryService extends Context.Tag("UserRepositoryService")<
  UserRepositoryService,
  UserRepository
>() {}

class EmailServiceTag extends Context.Tag("EmailService")<
  EmailServiceTag,
  EmailService
>() {}

// 3. Create implementations

// Console logger implementation
const consoleLogger: Logger = {
  log: (message) => Effect.sync(() => console.log(`[INFO] ${message}`)),
  error: (message, error) =>
    Effect.sync(() => {
      console.error(`[ERROR] ${message}`);
      if (error) console.error(error);
    }),
};

// In-memory user repository implementation
const createInMemoryUserRepository = (): UserRepository => {
  const users = new Map<string, User>();

  return {
    findById: (id) =>
      Effect.sync(() => {
        const user = users.get(id);
        return user || null;
      }),
    save: (user) =>
      Effect.sync(() => {
        users.set(user.id, user);
        return user;
      }),
  };
};

// Email service implementation
const createEmailService = (): EmailService => {
  return {
    sendWelcomeEmail: (user) =>
      Effect.flatMap(LoggerService, (logger) =>
        logger.log(`Sending welcome email to ${user.email}`)
      ),
  };
};

// 4. Create a service that depends on other services
const createUserService = () => {
  const registerUser = (
    name: string,
    email: string
  ): Effect.Effect<User> => {
    return pipe(
      // Create a unique ID
      Effect.sync(() => ({ id: `user-${Date.now()}`, name, email })),
      // Save the user
      Effect.flatMap((user) =>
        pipe(
          Effect.flatMap(UserRepositoryService, (repo) => repo.save(user)),
          // Send welcome email
          Effect.tap((savedUser) =>
            Effect.flatMap(EmailServiceTag, (emailService) =>
              emailService.sendWelcomeEmail(savedUser)
            )
          ),
          // Log the success
          Effect.tap((savedUser) =>
            Effect.flatMap(LoggerService, (logger) =>
              logger.log(`User registered: ${savedUser.id}`)
            )
          )
        )
      )
    );
  };

  return { registerUser };
};

// 5. Run with provided dependencies
const runDependencyInjectionExample = async () => {
  const { registerUser } = createUserService();

  // Create the effect with all dependencies
  const program = pipe(
    registerUser("John Doe", "john@example.com"),
    Effect.provide(LoggerService.of(consoleLogger)),
    Effect.provide(UserRepositoryService.of(createInMemoryUserRepository())),
    Effect.provide(EmailServiceTag.of(createEmailService()))
  );

  // Run the program
  const user = await Effect.runPromise(program);
  console.log("Registered user:", user);
};

// Call this to run the example
// runDependencyInjectionExample().catch(console.error);

export {
  Logger,
  UserRepository,
  EmailService,
  LoggerService,
  UserRepositoryService,
  EmailServiceTag,
  consoleLogger,
  createInMemoryUserRepository,
  createEmailService,
  createUserService,
  runDependencyInjectionExample,
};
