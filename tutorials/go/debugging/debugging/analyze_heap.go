package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

func main() {
	// Parse command line arguments
	heapFile := flag.String("file", "", "Heap profile file to analyze")
	diff := flag.String("diff", "", "Second heap profile for comparison")
	server := flag.Bool("server", true, "Start a web server for interactive analysis")
	port := flag.Int("port", 8080, "Port for web server")
	flag.Parse()
	
	if *heapFile == "" {
		fmt.Println("Please provide a heap profile file with -file")
		flag.Usage()
		os.Exit(1)
	}
	
	// Verify file exists
	if _, err := os.Stat(*heapFile); os.IsNotExist(err) {
		log.Fatalf("Heap profile file not found: %s", *heapFile)
	}
	
	// Get absolute path
	absPath, err := filepath.Abs(*heapFile)
	if err != nil {
		log.Fatalf("Failed to get absolute path: %v", err)
	}
	
	fmt.Printf("Analyzing heap profile: %s\n", absPath)
	
	// Text-based analysis first
	fmt.Println("\n=== Top 10 memory allocations ===")
	cmd := exec.Command("go", "tool", "pprof", "-top", "-lines", absPath)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	if err := cmd.Run(); err != nil {
		log.Fatalf("Failed to run pprof top command: %v", err)
	}
	
	// Diff analysis if requested
	if *diff != "" {
		if _, err := os.Stat(*diff); os.IsNotExist(err) {
			log.Fatalf("Second heap profile not found: %s", *diff)
		}
		
		absDiffPath, err := filepath.Abs(*diff)
		if err != nil {
			log.Fatalf("Failed to get absolute path: %v", err)
		}
		
		fmt.Printf("\n=== Comparing %s with %s ===\n", 
			filepath.Base(absPath), 
			filepath.Base(absDiffPath))
		
		cmd = exec.Command("go", "tool", "pprof", "-top", "-lines", 
			"-base", absDiffPath, absPath)
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		if err := cmd.Run(); err != nil {
			log.Fatalf("Failed to run pprof diff command: %v", err)
		}
	}
	
	// Start web server for interactive analysis if requested
	if *server {
		fmt.Printf("\n=== Starting pprof web server on port %d ===\n", *port)
		fmt.Printf("Open your browser at: http://localhost:%d\n", *port)
		fmt.Println("Press Ctrl+C to stop the server")
		
		cmd = exec.Command("go", "tool", "pprof", "-http", fmt.Sprintf(":%d", *port), absPath)
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
		if err := cmd.Run(); err != nil {
			// Don't fail on server exit
			if !strings.Contains(err.Error(), "signal: interrupt") {
				log.Fatalf("Failed to run pprof server: %v", err)
			}
		}
	}
}
