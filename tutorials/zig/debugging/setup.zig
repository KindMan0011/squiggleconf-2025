const std = @import("std");
const builtin = @import("builtin");

pub fn main() \!void {
    // Check Zig version
    std.debug.print("Zig version: {}\n", .{builtin.zig_version});
    std.debug.print("Target: {s}-{s}-{s}\n", .{
        @tagName(builtin.cpu.arch),
        @tagName(builtin.os.tag),
        @tagName(builtin.abi),
    });
    
    // Check for necessary tools
    const allocator = std.heap.page_allocator;
    
    // Check for lldb or gdb
    const lldb_check = try checkCommand(allocator, "lldb", "--version");
    if (lldb_check) {
        std.debug.print("LLDB is available\n", .{});
    } else {
        const gdb_check = try checkCommand(allocator, "gdb", "--version");
        if (gdb_check) {
            std.debug.print("GDB is available\n", .{});
        } else {
            std.debug.print("Neither LLDB nor GDB found. Install one for better debugging experience.\n", .{});
        }
    }
    
    std.debug.print("\nYou're ready to start the Zig debugging and AST analysis tutorial\!\n", .{});
}

fn checkCommand(allocator: std.mem.Allocator, command: []const u8, arg: []const u8) \!bool {
    const result = std.ChildProcess.exec(.{
        .allocator = allocator,
        .argv = &[_][]const u8{ command, arg },
    }) catch return false;
    defer {
        allocator.free(result.stdout);
        allocator.free(result.stderr);
    }
    return result.term.Exited and result.term.code == 0;
}
