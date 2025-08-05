const std = @import("std");

// Define our custom AST nodes
const ExprType = enum {
    literal,
    binary,
    unary,
    variable,
    block,
    if_expr,
    assignment,
};

const BinaryOp = enum {
    add,
    subtract,
    multiply,
    divide,
    equals,
    not_equals,
    less_than,
    greater_than,
};

const UnaryOp = enum {
    negate,
    not,
};

// Define the expression type using a tagged union
const Expr = union(ExprType) {
    literal: LiteralExpr,
    binary: BinaryExpr,
    unary: UnaryExpr,
    variable: VariableExpr,
    block: BlockExpr,
    if_expr: IfExpr,
    assignment: AssignmentExpr,

    // Create functions to construct expressions
    pub fn number(value: f64) Expr {
        return Expr{ .literal = LiteralExpr{ .number = value } };
    }
    
    pub fn boolean(value: bool) Expr {
        return Expr{ .literal = LiteralExpr{ .boolean = value } };
    }
    
    pub fn string(value: []const u8) Expr {
        return Expr{ .literal = LiteralExpr{ .string = value } };
    }
    
    pub fn binary(left: Expr, op: BinaryOp, right: Expr) Expr {
        return Expr{ .binary = BinaryExpr{ .left = left, .operator = op, .right = right } };
    }
    
    pub fn unary(op: UnaryOp, right: Expr) Expr {
        return Expr{ .unary = UnaryExpr{ .operator = op, .right = right } };
    }
    
    pub fn variable(name: []const u8) Expr {
        return Expr{ .variable = VariableExpr{ .name = name } };
    }
    
    pub fn block(statements: []const Expr) Expr {
        return Expr{ .block = BlockExpr{ .statements = statements } };
    }
    
    pub fn if_expr(condition: Expr, then_branch: Expr, else_branch: ?Expr) Expr {
        return Expr{ .if_expr = IfExpr{
            .condition = condition,
            .then_branch = then_branch,
            .else_branch = else_branch,
        }};
    }
    
    pub fn assignment(name: []const u8, value: Expr) Expr {
        return Expr{ .assignment = AssignmentExpr{
            .name = name,
            .value = value,
        }};
    }
};

// Value type for our interpreter
const Value = union(enum) {
    number: f64,
    boolean: bool,
    string: []const u8,
    null_val: void,
    
    // Helper methods for printing
    pub fn format(self: Value, comptime fmt: []const u8, options: std.fmt.FormatOptions, writer: anytype) \!void {
        _ = fmt;
        _ = options;
        
        switch (self) {
            .number => |n| try writer.print("{d}", .{n}),
            .boolean => |b| try writer.print("{}", .{b}),
            .string => |s| try writer.print("\"{s}\"", .{s}),
            .null_val => try writer.writeAll("null"),
        }
    }
};

// Expression node types
const LiteralExpr = union(enum) {
    number: f64,
    boolean: bool,
    string: []const u8,
};

const BinaryExpr = struct {
    left: Expr,
    operator: BinaryOp,
    right: Expr,
};

const UnaryExpr = struct {
    operator: UnaryOp,
    right: Expr,
};

const VariableExpr = struct {
    name: []const u8,
};

const BlockExpr = struct {
    statements: []const Expr,
};

const IfExpr = struct {
    condition: Expr,
    then_branch: Expr,
    else_branch: ?Expr,
};

const AssignmentExpr = struct {
    name: []const u8,
    value: Expr,
};

// Environment to hold variables
const Environment = struct {
    variables: std.StringHashMap(Value),
    
    pub fn init(allocator: std.mem.Allocator) Environment {
        return Environment{
            .variables = std.StringHashMap(Value).init(allocator),
        };
    }
    
    pub fn deinit(self: *Environment) void {
        self.variables.deinit();
    }
    
    pub fn define(self: *Environment, name: []const u8, value: Value) \!void {
        try self.variables.put(name, value);
    }
    
    pub fn get(self: Environment, name: []const u8) ?Value {
        return self.variables.get(name);
    }
    
    pub fn assign(self: *Environment, name: []const u8, value: Value) \!void {
        if (self.variables.contains(name)) {
            try self.variables.put(name, value);
        } else {
            return error.UndefinedVariable;
        }
    }
};

// Interpreter to evaluate expressions
const Interpreter = struct {
    env: *Environment,
    
    pub fn init(env: *Environment) Interpreter {
        return Interpreter{ .env = env };
    }
    
    // Main evaluation function
    pub fn evaluate(self: *Interpreter, expr: Expr) \!Value {
        switch (expr) {
            .literal => |lit| {
                return switch (lit) {
                    .number => |n| Value{ .number = n },
                    .boolean => |b| Value{ .boolean = b },
                    .string => |s| Value{ .string = s },
                };
            },
            .binary => |bin| {
                const left = try self.evaluate(bin.left);
                const right = try self.evaluate(bin.right);
                
                return try self.evaluateBinary(left, bin.operator, right);
            },
            .unary => |un| {
                const right = try self.evaluate(un.right);
                
                return try self.evaluateUnary(un.operator, right);
            },
            .variable => |var_expr| {
                if (self.env.get(var_expr.name)) |value| {
                    return value;
                }
                return error.UndefinedVariable;
            },
            .block => |block| {
                var result = Value{ .null_val = {} };
                
                for (block.statements) |statement| {
                    result = try self.evaluate(statement);
                }
                
                return result;
            },
            .if_expr => |if_expr| {
                const condition = try self.evaluate(if_expr.condition);
                
                if (condition \!= .boolean) {
                    return error.TypeMismatch;
                }
                
                if (condition.boolean) {
                    return try self.evaluate(if_expr.then_branch);
                } else if (if_expr.else_branch) |else_branch| {
                    return try self.evaluate(else_branch);
                } else {
                    return Value{ .null_val = {} };
                }
            },
            .assignment => |assign| {
                const value = try self.evaluate(assign.value);
                try self.env.assign(assign.name, value);
                return value;
            },
        }
    }
    
    // Helper functions for evaluation
    fn evaluateBinary(self: *Interpreter, left: Value, op: BinaryOp, right: Value) \!Value {
        _ = self;
        
        // Type check for numeric operations
        if (op == .add or op == .subtract or op == .multiply or op == .divide) {
            if (left \!= .number or right \!= .number) {
                return error.TypeMismatch;
            }
            
            switch (op) {
                .add => return Value{ .number = left.number + right.number },
                .subtract => return Value{ .number = left.number - right.number },
                .multiply => return Value{ .number = left.number * right.number },
                .divide => {
                    if (right.number == 0) {
                        return error.DivisionByZero;
                    }
                    return Value{ .number = left.number / right.number };
                },
                else => unreachable,
            }
        }
        
        // Type check for comparison operations
        if (op == .equals or op == .not_equals) {
            // Compare based on type
            if (@as(std.meta.Tag(Value), left) \!= @as(std.meta.Tag(Value), right)) {
                return Value{ .boolean = false };
            }
            
            switch (left) {
                .number => {
                    const equal = left.number == right.number;
                    return Value{ .boolean = if (op == .equals) equal else \!equal };
                },
                .boolean => {
                    const equal = left.boolean == right.boolean;
                    return Value{ .boolean = if (op == .equals) equal else \!equal };
                },
                .string => {
                    const equal = std.mem.eql(u8, left.string, right.string);
                    return Value{ .boolean = if (op == .equals) equal else \!equal };
                },
                .null_val => {
                    return Value{ .boolean = if (op == .equals) true else false };
                },
            }
        }
        
        // Type check for comparison operations
        if (op == .less_than or op == .greater_than) {
            if (left \!= .number or right \!= .number) {
                return error.TypeMismatch;
            }
            
            switch (op) {
                .less_than => return Value{ .boolean = left.number < right.number },
                .greater_than => return Value{ .boolean = left.number > right.number },
                else => unreachable,
            }
        }
        
        return error.InvalidOperation;
    }
    
    fn evaluateUnary(self: *Interpreter, op: UnaryOp, right: Value) \!Value {
        _ = self;
        
        switch (op) {
            .negate => {
                if (right \!= .number) {
                    return error.TypeMismatch;
                }
                return Value{ .number = -right.number };
            },
            .not => {
                if (right \!= .boolean) {
                    return error.TypeMismatch;
                }
                return Value{ .boolean = \!right.boolean };
            },
        }
    }
};

// Helper to run an example program
fn runExample(allocator: std.mem.Allocator, program: []const Expr) \!void {
    var env = Environment.init(allocator);
    defer env.deinit();
    
    var interpreter = Interpreter.init(&env);
    
    // Define some initial variables
    try env.define("pi", Value{ .number = 3.14159 });
    try env.define("greeting", Value{ .string = "Hello, World\!" });
    
    // Run the program
    std.debug.print("=== Running Example Program ===\n", .{});
    for (program, 0..) |expr, i| {
        std.debug.print("Expression {d}: ", .{i + 1});
        const result = try interpreter.evaluate(expr);
        std.debug.print("{any}\n", .{result});
    }
    std.debug.print("=== Program Complete ===\n", .{});
}

pub fn main() \!void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();
    
    // Define a simple program
    const program = [_]Expr{
        // x = 10
        Expr.assignment("x", Expr.number(10)),
        
        // y = 20
        Expr.assignment("y", Expr.number(20)),
        
        // x + y
        Expr.binary(Expr.variable("x"), .add, Expr.variable("y")),
        
        // if (x > 5) { x * 2 } else { y * 2 }
        Expr.if_expr(
            Expr.binary(Expr.variable("x"), .greater_than, Expr.number(5)),
            Expr.binary(Expr.variable("x"), .multiply, Expr.number(2)),
            Expr.binary(Expr.variable("y"), .multiply, Expr.number(2))
        ),
        
        // z = pi * 2
        Expr.assignment("z", Expr.binary(Expr.variable("pi"), .multiply, Expr.number(2))),
        
        // z
        Expr.variable("z"),
        
        // greeting
        Expr.variable("greeting"),
    };
    
    try runExample(allocator, &program);
}
