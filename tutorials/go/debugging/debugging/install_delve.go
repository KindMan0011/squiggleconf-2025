package main

import (
	"fmt"
	"os"
	"os/exec"
	"runtime"
)

func main() {
	fmt.Println("=== Installing Delve Debugger ===")
	
	// Check Go version first
	cmd := exec.Command("go", "version")
	output, err := cmd.CombinedOutput()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to check Go version: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("Using %s\n", string(output))
	
	// Install Delve
	fmt.Println("\nInstalling Delve debugger...")
	var installCmd *exec.Cmd
	
	switch runtime.GOOS {
	case "darwin":
		installCmd = exec.Command("go", "install", "github.com/go-delve/delve/cmd/dlv@latest")
	case "linux", "freebsd":
		installCmd = exec.Command("go", "install", "github.com/go-delve/delve/cmd/dlv@latest")
	case "windows":
		installCmd = exec.Command("go", "install", "github.com/go-delve/delve/cmd/dlv@latest")
	default:
		fmt.Fprintf(os.Stderr, "Unsupported operating system: %s\n", runtime.GOOS)
		os.Exit(1)
	}
	
	output, err = installCmd.CombinedOutput()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to install Delve: %v\n%s\n", err, string(output))
		fmt.Println("\nAlternative installation:")
		fmt.Println("- Clone: git clone https://github.com/go-delve/delve")
		fmt.Println("- Build: cd delve && go install github.com/go-delve/delve/cmd/dlv")
		os.Exit(1)
	}
	
	fmt.Println("Delve installed successfully.")
	fmt.Println("\nVerify installation by running: dlv version")
	fmt.Println("\nUsage:")
	fmt.Println("- Debug package: dlv debug github.com/example/pkg")
	fmt.Println("- Attach to process: dlv attach <pid>")
	fmt.Println("- Connect to headless server: dlv connect <addr>")
}
