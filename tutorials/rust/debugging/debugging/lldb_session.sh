#!/bin/bash
# Script demonstrating LLDB debugging commands for Rust

# Build with debug symbols
cargo build --bin debug_sample

echo "=== LLDB Debugging Session for Rust ==="
echo "Starting debugging session...\n"

cat << 'EOF'
# Start LLDB with the compiled binary
lldb target/debug/debug_sample

# Set breakpoints
breakpoint set --name main
breakpoint set --name find_user_by_id

# Run the program
run

# Continue to the next breakpoint
continue

# Examine arguments and local variables
frame variable

# Show the source code context
source list

# Step through code
step

# Step over functions
next

# Print expressions
expression users.len()
expression users[0].name

# Check memory addresses and raw pointers
expression &users[0]
expression --raw-output -- users.as_ptr()

# Examine Rust smart pointers
expression --dynamic-type true -- users

# Create a watchpoint for a variable
watchpoint set variable users[0].active

# Continue with watchpoint set
continue

# Show backtrace
bt

# Switch to a different frame
frame select 1

# Examine Rust types
type summary show --summary-string "${var.id}: ${var.name}" User

# Show User instances with custom summary
frame variable --show-types users

# Exit debugger
quit
EOF

echo "\nTo run the full debugging session, execute:"
echo "lldb target/debug/debug_sample"
