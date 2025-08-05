// Check Rust version and required components
fn main() {
    println!("Rust version: {}", rustc_version());
    println!("Checking for required components...");
    
    // Check for rust-analyzer
    if let Some(version) = rust_analyzer_version() {
        println!("rust-analyzer: {}", version);
    } else {
        println!("rust-analyzer: Not found. Install with 'rustup component add rust-analyzer'.");
    }
    
    // Check for lldb or gdb
    if let Some(version) = lldb_version() {
        println!("LLDB: {}", version);
    } else if let Some(version) = gdb_version() {
        println!("GDB: {}", version);
    } else {
        println!("Neither LLDB nor GDB found. Install one for better debugging experience.");
    }
    
    // Check for syn and quote crates
    println!("\nRequired crates for AST manipulation:");
    println!("Add these to your Cargo.toml:");
    println!("syn = {{ version = \"2.0\", features = [\"full\", \"extra-traits\"] }}");
    println!("quote = \"2.0\"");
    println!("proc-macro2 = \"1.0\"");
}

// Helper functions to get version information
fn rustc_version() -> String {
    let output = std::process::Command::new("rustc")
        .arg("--version")
        .output()
        .expect("Failed to execute rustc");
    
    String::from_utf8_lossy(&output.stdout).trim().to_string()
}

fn rust_analyzer_version() -> Option<String> {
    let output = std::process::Command::new("rust-analyzer")
        .arg("--version")
        .output();
    
    if let Ok(output) = output {
        Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        None
    }
}

fn lldb_version() -> Option<String> {
    let output = std::process::Command::new("lldb")
        .arg("--version")
        .output();
    
    if let Ok(output) = output {
        Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        None
    }
}

fn gdb_version() -> Option<String> {
    let output = std::process::Command::new("gdb")
        .arg("--version")
        .output();
    
    if let Ok(output) = output {
        let version = String::from_utf8_lossy(&output.stdout);
        Some(version.lines().next().unwrap_or("").trim().to_string())
    } else {
        None
    }
}
