#!/bin/bash
# Script demonstrating Delve debugging commands

# Build the sample program with debug symbols
go build -gcflags="all=-N -l" -o debug_app debug_sample.go

echo "=== Delve Debugging Session ==="
echo "Starting debugging session..."

# Run these commands manually in the delve console:
cat << 'EOF'
# Start Delve with our app
dlv exec ./debug_app

# Set breakpoints
break main.buggyFunction
break main.dataRaceFunction

# Start the program
continue

# Examine variables
print n

# Add a condition to a breakpoint
condition 1 n == 5

# Continue execution until next breakpoint
continue

# Step into a function
step

# Step over a line
next

# Check local variables
locals

# View goroutines
goroutines

# Switch to a specific goroutine
goroutine 1

# View stack trace
stack

# Create a watchpoint (watching a variable for changes)
watch counter

# Evaluate expressions
print counter + 5

# Check thread status
threads

# View deferred functions
deferrers

# Disassemble current function
disassemble

# Set a tracepoint (continue execution after hitting)
trace main.dataRaceFunction

# Exit debugger
exit
EOF

echo
echo "To run a full debugging session, execute:"
echo "dlv exec ./debug_app"
