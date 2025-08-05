#!/bin/bash
# Script demonstrating memory analysis tools for Rust

# Build with debug symbols
cargo build --bin memory_issues

echo "=== Memory Analysis for Rust Programs ==="

# Check if Valgrind is installed
if command -v valgrind &> /dev/null; then
    echo "\n== Running Valgrind for memory leak detection =="
    valgrind --leak-check=full --show-leak-kinds=all --track-origins=yes ./target/debug/memory_issues
else
    echo "Valgrind not found. Install with 'sudo apt-get install valgrind' on Ubuntu/Debian"
fi

# Check if we can use Miri
echo "\n== Setting up Miri (Rust's memory issue detector) =="
echo "Run these commands to install and use Miri:"

cat << 'EOF'
# Install Miri
rustup +nightly component add miri

# Run the Miri interpreter
cargo +nightly miri run

# Run Miri with specific flags for better detection
cargo +nightly miri run -- -Zmiri-tag-raw-pointers -Zmiri-check-number-validity

# Run tests with Miri
cargo +nightly miri test

# Common Miri errors and their meanings:
# - "dangling pointer" or "null pointer dereference": Attempting to access invalid memory
# - "no item at offset": Accessing outside of allocated memory bounds
# - "not grounded": Using a pointer derived from a freed allocation
# - "created from unrelated allocation": Pointer arithmetic leading outside the allocation
# - "no longer exists": Use-after-free
EOF

echo "\n== Memory analysis tools comparison =="
echo "1. Valgrind: Detects memory leaks, use-after-free, invalid memory accesses"
echo "2. Miri: Detects undefined behavior in Rust code, including memory issues"
echo "3. ASAN (Address Sanitizer): Fast memory error detector"

cat << 'EOF'
# To use ASAN with Rust:
rustup component add rust-src
CFLAGS="-fsanitize=address" cargo run -Zbuild-std --target x86_64-unknown-linux-gnu
EOF

echo "\n== Tools for analyzing heap allocations =="
echo "Dhat: Heap profiling tool included with Valgrind"

cat << 'EOF'
# To use Dhat:
valgrind --tool=dhat ./target/debug/memory_issues
EOF

echo "\nMemory analysis instructions complete"
