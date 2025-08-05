const std = @import("std");

/// Utility to automatically generate a hash function for any struct
fn AutoHash(comptime T: type) type {
    return struct {
        pub fn hash(value: T) u64 {
            const info = @typeInfo(T);
            
            switch (info) {
                .Struct => {
                    var hasher = std.hash.Wyhash.init(0);
                    
                    inline for (info.Struct.fields) |field| {
                        const field_value = @field(value, field.name);
                        
                        switch (@typeInfo(field.type)) {
                            .Int, .Float => std.hash.autoHash(&hasher, field_value),
                            .Bool => std.hash.autoHash(&hasher, @intFromBool(field_value)),
                            .Pointer => |ptr_info| {
                                if (ptr_info.size == .Slice and ptr_info.child == u8) {
                                    // Hash string content
                                    std.hash.autoHash(&hasher, std.hash.hashString(field_value));
                                } else {
                                    @compileError("Unsupported pointer type for field " ++ field.name);
                                }
                            },
                            .Enum => std.hash.autoHash(&hasher, @intFromEnum(field_value)),
                            .Array => |arr_info| {
                                if (arr_info.child == u8) {
                                    // Fixed string
                                    std.hash.autoHash(&hasher, std.hash.hashString(&field_value));
                                } else {
                                    // Other arrays
                                    for (field_value) |item| {
                                        std.hash.autoHash(&hasher, item);
                                    }
                                }
                            },
                            else => @compileError("Unsupported type for field " ++ field.name),
                        }
                    }
                    
                    return hasher.final();
                },
                else => @compileError("AutoHash only works on structs, got " ++ @typeName(T)),
            }
        }
        
        pub fn eql(a: T, b: T) bool {
            const info = @typeInfo(T);
            
            switch (info) {
                .Struct => {
                    inline for (info.Struct.fields) |field| {
                        const a_value = @field(a, field.name);
                        const b_value = @field(b, field.name);
                        
                        switch (@typeInfo(field.type)) {
                            .Pointer => |ptr_info| {
                                if (ptr_info.size == .Slice and ptr_info.child == u8) {
                                    if (\!std.mem.eql(u8, a_value, b_value)) {
                                        return false;
                                    }
                                } else {
                                    @compileError("Unsupported pointer type for field " ++ field.name);
                                }
                            },
                            else => {
                                if (a_value \!= b_value) {
                                    return false;
                                }
                            },
                        }
                    }
                    
                    return true;
                },
                else => @compileError("Eql only works on structs, got " ++ @typeName(T)),
            }
        }
    };
}

/// Utility to auto-generate format function for any struct
fn AutoFormat(comptime T: type) type {
    return struct {
        pub fn format(
            value: T,
            comptime fmt: []const u8,
            options: std.fmt.FormatOptions,
            writer: anytype,
        ) \!void {
            _ = fmt;
            _ = options;
            
            const info = @typeInfo(T);
            
            switch (info) {
                .Struct => {
                    try writer.writeAll(@typeName(T) ++ "{ ");
                    
                    inline for (info.Struct.fields, 0..) |field, i| {
                        if (i > 0) {
                            try writer.writeAll(", ");
                        }
                        
                        try writer.writeAll(field.name ++ ": ");
                        
                        const field_value = @field(value, field.name);
                        
                        switch (@typeInfo(field.type)) {
                            .Int => try std.fmt.format(writer, "{d}", .{field_value}),
                            .Float => try std.fmt.format(writer, "{d}", .{field_value}),
                            .Bool => try std.fmt.format(writer, "{}", .{field_value}),
                            .Pointer => |ptr_info| {
                                if (ptr_info.size == .Slice and ptr_info.child == u8) {
                                    try std.fmt.format(writer, "\"{s}\"", .{field_value});
                                } else {
                                    @compileError("Unsupported pointer type for field " ++ field.name);
                                }
                            },
                            .Enum => try std.fmt.format(writer, ".{s}", .{@tagName(field_value)}),
                            .Array => |arr_info| {
                                if (arr_info.child == u8) {
                                    try std.fmt.format(writer, "\"{s}\"", .{&field_value});
                                } else {
                                    try writer.writeAll("{");
                                    for (field_value, 0..) |item, j| {
                                        if (j > 0) try writer.writeAll(", ");
                                        try std.fmt.format(writer, "{any}", .{item});
                                    }
                                    try writer.writeAll("}");
                                }
                            },
                            else => try std.fmt.format(writer, "{any}", .{field_value}),
                        }
                    }
                    
                    try writer.writeAll(" }");
                },
                else => @compileError("AutoFormat only works on structs, got " ++ @typeName(T)),
            }
        }
    };
}

/// Utility to clone a struct deeply
fn clone(allocator: std.mem.Allocator, value: anytype) \!@TypeOf(value) {
    const T = @TypeOf(value);
    const info = @typeInfo(T);
    
    switch (info) {
        .Struct => {
            var result: T = undefined;
            
            inline for (info.Struct.fields) |field| {
                const field_value = @field(value, field.name);
                const field_type = @TypeOf(field_value);
                
                switch (@typeInfo(field_type)) {
                    .Pointer => |ptr_info| {
                        if (ptr_info.size == .Slice and ptr_info.child == u8) {
                            // Clone string
                            const new_str = try allocator.alloc(u8, field_value.len);
                            @memcpy(new_str, field_value);
                            @field(result, field.name) = new_str;
                        } else {
                            @compileError("Unsupported pointer type for field " ++ field.name);
                        }
                    },
                    .Array => |arr_info| {
                        if (arr_info.child == u8) {
                            // Fixed string, copy directly
                            @field(result, field.name) = field_value;
                        } else {
                            // Other arrays
                            @field(result, field.name) = field_value;
                        }
                    },
                    else => @field(result, field.name) = field_value,
                }
            }
            
            return result;
        },
        else => @compileError("Clone only works on structs, got " ++ @typeName(T)),
    }
}

/// Example struct for our tests
const Person = struct {
    id: u64,
    name: []const u8,
    age: u32,
    height: f32,
    is_active: bool,
    favorite_colors: [3][]const u8,
    
    // Use our auto-generated format function
    pub fn format(
        self: Person,
        comptime fmt: []const u8,
        options: std.fmt.FormatOptions,
        writer: anytype,
    ) \!void {
        return AutoFormat(Person).format(self, fmt, options, writer);
    }
    
    // Use our auto-generated hash function
    pub fn hash(self: Person) u64 {
        return AutoHash(Person).hash(self);
    }
    
    // Use our auto-generated equals function
    pub fn eql(self: Person, other: Person) bool {
        return AutoHash(Person).eql(self, other);
    }
};

/// Generate diff between two structs of the same type
fn diff(comptime T: type, a: T, b: T, writer: anytype) \!void {
    const info = @typeInfo(T);
    
    switch (info) {
        .Struct => {
            var has_diff = false;
            
            try writer.writeAll("Changes in " ++ @typeName(T) ++ ":\n");
            
            inline for (info.Struct.fields) |field| {
                const a_value = @field(a, field.name);
                const b_value = @field(b, field.name);
                var field_differs = false;
                
                switch (@typeInfo(field.type)) {
                    .Pointer => |ptr_info| {
                        if (ptr_info.size == .Slice and ptr_info.child == u8) {
                            field_differs = \!std.mem.eql(u8, a_value, b_value);
                        } else {
                            @compileError("Unsupported pointer type for field " ++ field.name);
                        }
                    },
                    else => field_differs = a_value \!= b_value,
                }
                
                if (field_differs) {
                    has_diff = true;
                    try writer.writeAll("  " ++ field.name ++ ": ");
                    
                    switch (@typeInfo(field.type)) {
                        .Int => try writer.print("{d} -> {d}\n", .{ a_value, b_value }),
                        .Float => try writer.print("{d} -> {d}\n", .{ a_value, b_value }),
                        .Bool => try writer.print("{} -> {}\n", .{ a_value, b_value }),
                        .Pointer => |ptr_info| {
                            if (ptr_info.size == .Slice and ptr_info.child == u8) {
                                try writer.print("\"{s}\" -> \"{s}\"\n", .{ a_value, b_value });
                            }
                        },
                        .Enum => try writer.print(".{s} -> .{s}\n", .{ @tagName(a_value), @tagName(b_value) }),
                        else => try writer.print("{any} -> {any}\n", .{ a_value, b_value }),
                    }
                }
            }
            
            if (\!has_diff) {
                try writer.writeAll("  No differences found\n");
            }
        },
        else => @compileError("Diff only works on structs, got " ++ @typeName(T)),
    }
}

pub fn main() \!void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();
    
    // Create test data
    const colors1 = [_][]const u8{ "red", "green", "blue" };
    const colors2 = [_][]const u8{ "purple", "green", "yellow" };
    
    const person1 = Person{
        .id = 1,
        .name = "Alice",
        .age = 30,
        .height = 175.5,
        .is_active = true,
        .favorite_colors = colors1,
    };
    
    var person2 = Person{
        .id = 1,
        .name = "Alice Johnson",
        .age = 31,
        .height = 175.5,
        .is_active = false,
        .favorite_colors = colors2,
    };
    
    // Demo auto-format
    std.debug.print("=== Auto-Format Demo ===\n", .{});
    std.debug.print("Person 1: {}\n", .{person1});
    std.debug.print("Person 2: {}\n\n", .{person2});
    
    // Demo auto-hash
    std.debug.print("=== Auto-Hash Demo ===\n", .{});
    const hash1 = person1.hash();
    const hash2 = person2.hash();
    std.debug.print("Person 1 hash: {x}\n", .{hash1});
    std.debug.print("Person 2 hash: {x}\n", .{hash2});
    std.debug.print("Equal: {}\n\n", .{person1.eql(person2)});
    
    // Demo diff
    std.debug.print("=== Diff Demo ===\n", .{});
    try diff(Person, person1, person2, std.io.getStdOut().writer());
    std.debug.print("\n", .{});
    
    // Demo clone
    std.debug.print("=== Clone Demo ===\n", .{});
    const person3 = try clone(allocator, person1);
    std.debug.print("Original: {}\n", .{person1});
    std.debug.print("Clone: {}\n", .{person3});
    std.debug.print("Equal: {}\n\n", .{person1.eql(person3)});
    
    // Free cloned memory
    for (person3.favorite_colors) |color| {
        allocator.free(color);
    }
    allocator.free(person3.name);
}
