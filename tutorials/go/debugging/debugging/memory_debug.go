package main

import (
	"fmt"
	"net/http"
	_ "net/http/pprof"  // Import for side-effects: registers pprof handlers
	"os"
	"runtime"
	"runtime/debug"
	"runtime/pprof"
	"time"
)

// Memory leak simulation
var leakySlice []string

// Function with a memory leak
func leakyFunction() {
	fmt.Println("Running leaky function...")
	
	// This slice grows unbounded, causing a memory leak
	for i := 0; i < 10000; i++ {
		data := make([]byte, 1024*1024) // Allocate 1MB
		s := fmt.Sprintf("Data block %d: %d bytes", i, len(data))
		leakySlice = append(leakySlice, s)
		
		// Simulate processing
		time.Sleep(1 * time.Millisecond)
		
		// Print memory stats every 1000 iterations
		if i%1000 == 0 {
			printMemStats()
		}
	}
}

// Print current memory statistics
func printMemStats() {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	
	fmt.Printf("Alloc: %v MiB\n", m.Alloc / 1024 / 1024)
	fmt.Printf("TotalAlloc: %v MiB\n", m.TotalAlloc / 1024 / 1024)
	fmt.Printf("Sys: %v MiB\n", m.Sys / 1024 / 1024)
	fmt.Printf("NumGC: %v\n", m.NumGC)
	fmt.Printf("Goroutines: %d\n", runtime.NumGoroutine())
	fmt.Println()
}

// Take a heap snapshot to a file
func saveHeapProfile(filename string) {
	f, err := os.Create(filename)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Failed to create heap profile: %v\n", err)
		return
	}
	defer f.Close()
	
	fmt.Println("Writing heap profile to", filename)
	
	// Force garbage collection before profiling
	runtime.GC()
	
	if err := pprof.WriteHeapProfile(f); err != nil {
		fmt.Fprintf(os.Stderr, "Failed to write heap profile: %v\n", err)
	}
}

// Save memory profile at regular intervals
func startProfiler() {
	// Setup HTTP server for pprof
	go func() {
		fmt.Println("Starting pprof server on :6060")
		fmt.Println("Access profiling data at http://localhost:6060/debug/pprof/")
		http.ListenAndServe(":6060", nil)
	}()
	
	// Take snapshots every 2 seconds
	go func() {
		for i := 1; ; i++ {
			filename := fmt.Sprintf("heap_%d.prof", i)
			saveHeapProfile(filename)
			time.Sleep(2 * time.Second)
		}
	}()
}

func main() {
	// Set garbage collection parameters for debugging
	debug.SetGCPercent(100) // Default is 100
	
	// Start the profiler
	startProfiler()
	
	// Run leaky function
	leakyFunction()
	
	// Print final stats
	fmt.Println("Final memory statistics:")
	printMemStats()
	
	fmt.Println("Program completed. Check heap profiles for memory growth.")
	fmt.Println("To analyze the profiles:")
	fmt.Println("go tool pprof -http=:8080 heap_1.prof")
	fmt.Println("go tool pprof -http=:8080 http://localhost:6060/debug/pprof/heap")
}
