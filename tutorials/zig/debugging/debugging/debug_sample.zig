const std = @import("std");

// Define a simple struct for demonstration
const User = struct {
    id: u64,
    name: []const u8,
    email: []const u8,
    active: bool,
    
    pub fn init(id: u64, name: []const u8, email: []const u8) User {
        return User{
            .id = id,
            .name = name,
            .email = email,
            .active = true,
        };
    }
    
    pub fn deactivate(self: *User) void {
        self.active = false;
    }
    
    pub fn print(self: User) void {
        std.debug.print("User {d}: {s} ({s}) - Active: {}\n", .{
            self.id, self.name, self.email, self.active
        });
    }
};

// A function with a bug for debugging practice
fn findUserById(users: []const User, id: u64) ?*const User {
    // Bug: Off-by-one error in the loop bound
    for (users, 0..users.len - 1)  < /dev/null | *user, i| {
        if (user.id == id) {
            return user;
        }
    }
    return null;
}

// A recursive function to demonstrate stack analysis
fn factorial(n: u64) u64 {
    if (n <= 1) return 1;
    return n * factorial(n - 1);
}

// A function with a potential overflow issue
fn sumNumbers(numbers: []const u32) u32 {
    var sum: u32 = 0;
    for (numbers) |num| {
        // Potential overflow if sum + num > max u32
        sum += num;
    }
    return sum;
}

// Allocator demonstration for memory debugging
fn createLargeArray(allocator: std.mem.Allocator, size: usize) \![]u64 {
    const array = try allocator.alloc(u64, size);
    for (array, 0..) |*item, i| {
        item.* = i * i;
    }
    return array;
}

pub fn main() \!void {
    // Create a collection of users
    var users = [_]User{
        User.init(1, "Alice", "alice@example.com"),
        User.init(2, "Bob", "bob@example.com"),
        User.init(3, "Charlie", "charlie@example.com"),
        User.init(4, "Diana", "diana@example.com"),
    };
    
    // Deactivate one user
    users[1].deactivate();
    
    // Print all users
    for (users) |user| {
        user.print();
    }
    
    // Try to find users - the last one will fail due to the bug
    const found_user1 = findUserById(&users, 1);
    const found_user2 = findUserById(&users, 2);
    const found_user4 = findUserById(&users, 4); // This will fail due to the bug
    
    std.debug.print("\nLookup results:\n", .{});
    if (found_user1) |user| {
        std.debug.print("Found user 1: {s}\n", .{user.name});
    } else {
        std.debug.print("User 1 not found\n", .{});
    }
    
    if (found_user2) |user| {
        std.debug.print("Found user 2: {s}\n", .{user.name});
    } else {
        std.debug.print("User 2 not found\n", .{});
    }
    
    if (found_user4) |user| {
        std.debug.print("Found user 4: {s}\n", .{user.name});
    } else {
        std.debug.print("User 4 not found\n", .{});
    }
    
    // Demonstrate factorial for stack analysis
    const fact10 = factorial(10);
    std.debug.print("\nFactorial of 10 is {d}\n", .{fact10});
    
    // Demonstrate potential overflow
    const numbers = [_]u32{ 1, 2, 3, 4, 5, 4294967290 }; // Last number close to u32 max
    const sum = sumNumbers(&numbers);
    std.debug.print("Sum is {d}\n", .{sum});
    
    // Memory allocation demo
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();
    
    const large_array = try createLargeArray(allocator, 1000);
    defer allocator.free(large_array);
    
    std.debug.print("Created array of size {d}\n", .{large_array.len});
    std.debug.print("First few values: {d}, {d}, {d}...\n", .{
        large_array[0], large_array[1], large_array[2]
    });
}
