const std = @import("std");

// Define a struct that we want to generate code for
const User = struct {
    id: u64,
    name: []const u8,
    email: []const u8,
    created_at: i64,
    active: bool,
};

// Define a trait/interface that we want to implement
const Serializable = struct {
    pub fn serializeSignature(comptime T: type) type {
        return fn (value: T, writer: anytype) anyerror\!void;
    }
    
    pub fn deserializeSignature(comptime T: type) type {
        return fn (reader: anytype) anyerror\!T;
    }
};

// Generate JSON serialization code for any struct type
fn generateJsonSerializer(comptime T: type) Serializable.serializeSignature(T) {
    const TypeInfo = @typeInfo(T);
    
    return struct {
        fn serialize(value: T, writer: anytype) \!void {
            try writer.writeByte('{');
            
            inline for (TypeInfo.Struct.fields, 0..) |field, i| {
                // Write field name
                try writer.writeByte('"');
                try writer.writeAll(field.name);
                try writer.writeAll("\":");
                
                // Write field value based on its type
                switch (@typeInfo(field.type)) {
                    .Int => try writer.print("{d}", .{@field(value, field.name)}),
                    .Float => try writer.print("{d}", .{@field(value, field.name)}),
                    .Bool => try writer.print("{}", .{@field(value, field.name)}),
                    .Pointer => |ptr_info| {
                        if (ptr_info.size == .Slice && ptr_info.child == u8) {
                            // String
                            try writer.writeByte('"');
                            try writer.writeAll(@field(value, field.name));
                            try writer.writeByte('"');
                        } else {
                            @compileError("Unsupported pointer type for field " ++ field.name);
                        }
                    },
                    else => @compileError("Unsupported type for field " ++ field.name),
                }
                
                // Add comma if not the last field
                if (i < TypeInfo.Struct.fields.len - 1) {
                    try writer.writeByte(',');
                }
            }
            
            try writer.writeByte('}');
        }
    }.serialize;
}

// Generate code for a database table based on a struct
fn generateTableDefinition(comptime T: type) []const u8 {
    const TypeInfo = @typeInfo(T);
    
    comptime {
        var buffer: [4096]u8 = undefined;
        var fbs = std.io.fixedBufferStream(&buffer);
        const writer = fbs.writer();
        
        writer.writeAll("CREATE TABLE IF NOT EXISTS ") catch unreachable;
        writer.writeAll(@typeName(T)) catch unreachable;
        writer.writeAll(" (\n") catch unreachable;
        
        inline for (TypeInfo.Struct.fields, 0..) |field, i| {
            writer.writeAll("    ") catch unreachable;
            writer.writeAll(field.name) catch unreachable;
            writer.writeAll(" ") catch unreachable;
            
            // Map Zig types to SQL types
            switch (@typeInfo(field.type)) {
                .Int => {
                    if (field.name[0] == 'i' and field.name[1] == 'd') {
                        writer.writeAll("INTEGER PRIMARY KEY") catch unreachable;
                    } else {
                        writer.writeAll("INTEGER") catch unreachable;
                    }
                },
                .Float => writer.writeAll("REAL") catch unreachable,
                .Bool => writer.writeAll("BOOLEAN") catch unreachable,
                .Pointer => |ptr_info| {
                    if (ptr_info.size == .Slice && ptr_info.child == u8) {
                        writer.writeAll("TEXT") catch unreachable;
                    } else {
                        @compileError("Unsupported pointer type for field " ++ field.name);
                    }
                },
                else => @compileError("Unsupported type for field " ++ field.name),
            }
            
            // Add comma if not the last field
            if (i < TypeInfo.Struct.fields.len - 1) {
                writer.writeAll(",\n") catch unreachable;
            }
        }
        
        writer.writeAll("\n);") catch unreachable;
        
        return buffer[0..fbs.pos];
    }
}

// Generate a builder pattern for any struct
fn generateBuilder(comptime T: type) type {
    const TypeInfo = @typeInfo(T);
    
    // Create a builder struct with the same fields as the original
    var builder_fields: [TypeInfo.Struct.fields.len]std.builtin.Type.StructField = undefined;
    
    inline for (TypeInfo.Struct.fields, 0..) |field, i| {
        // Make all fields optional in the builder
        const FieldType = if (field.type == []const u8)
            // Pointers stay as is
            field.type
        else
            // Everything else becomes optional
            ?field.type;
        
        builder_fields[i] = .{
            .name = field.name,
            .type = FieldType,
            .default_value = &@as(?FieldType, null),
            .is_comptime = false,
            .alignment = @alignOf(FieldType),
        };
    }
    
    const BuilderType = @Type(.{
        .Struct = .{
            .layout = .Auto,
            .fields = &builder_fields,
            .decls = &.{},
            .is_tuple = false,
        },
    });
    
    return struct {
        builder: BuilderType,
        
        pub fn init() @This() {
            return .{ .builder = .{} };
        }
        
        // Generate setter methods for each field
        pub usingnamespace blk: {
            var decls: [TypeInfo.Struct.fields.len + 1]std.builtin.Type.Declaration = undefined;
            
            inline for (TypeInfo.Struct.fields, 0..) |field, i| {
                const FieldType = field.type;
                const field_name = field.name;
                
                // Create setter function for this field
                decls[i] = .{
                    .name = field_name,
                    .is_pub = true,
                    .data = std.builtin.Type.Declaration.Data{
                        .Fn = .{
                            .fn_type = *const fn (self: *@This(), value: FieldType) *@This(),
                            .alignment = 0,
                        },
                    },
                };
                
                // Define the setter function
                const Setter = struct {
                    fn setter(self: *@This(), value: FieldType) *@This() {
                        @field(self.builder, field_name) = value;
                        return self;
                    }
                };
                
                @field(@This(), field_name) = Setter.setter;
            }
            
            // Add the build method
            decls[TypeInfo.Struct.fields.len] = .{
                .name = "build",
                .is_pub = true,
                .data = std.builtin.Type.Declaration.Data{
                    .Fn = .{
                        .fn_type = *const fn (self: @This()) \!T,
                        .alignment = 0,
                    },
                },
            };
            
            const Namespace = @Type(.{
                .Struct = .{
                    .layout = .Auto,
                    .fields = &.{},
                    .decls = &decls,
                    .is_tuple = false,
                },
            });
            
            break :blk Namespace;
        },
        
        // The build method to create the final struct
        pub fn build(self: @This()) \!T {
            var result: T = undefined;
            
            // Check that all required fields are set
            inline for (TypeInfo.Struct.fields) |field| {
                const builder_value = @field(self.builder, field.name);
                
                if (builder_value == null and field.type \!= []const u8) {
                    return error.MissingRequiredField;
                }
                
                // Set the field in the result
                if (field.type == []const u8) {
                    // String type
                    @field(result, field.name) = if (builder_value) |v| v else "";
                } else {
                    // Other types
                    @field(result, field.name) = builder_value.?;
                }
            }
            
            return result;
        }
    };
}

pub fn main() \!void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();
    
    // 1. Generate and use a JSON serializer
    std.debug.print("=== Generated JSON Serializer ===\n", .{});
    
    const serializeUser = comptime generateJsonSerializer(User);
    
    const user = User{
        .id = 42,
        .name = "John Doe",
        .email = "john@example.com",
        .created_at = 1625097600,
        .active = true,
    };
    
    var json_buffer = std.ArrayList(u8).init(allocator);
    defer json_buffer.deinit();
    
    try serializeUser(user, json_buffer.writer());
    std.debug.print("JSON: {s}\n\n", .{json_buffer.items});
    
    // 2. Generate and display SQL table definition
    std.debug.print("=== Generated SQL Table Definition ===\n", .{});
    
    const table_definition = comptime generateTableDefinition(User);
    std.debug.print("{s}\n\n", .{table_definition});
    
    // 3. Generate and use a builder pattern
    std.debug.print("=== Generated Builder Pattern ===\n", .{});
    
    const UserBuilder = comptime generateBuilder(User);
    
    const built_user = try UserBuilder.init()
        .id(123)
        .name("Jane Smith")
        .email("jane@example.com")
        .created_at(1625184000)
        .active(true)
        .build();
    
    std.debug.print("Built User: {any}\n", .{built_user});
}
