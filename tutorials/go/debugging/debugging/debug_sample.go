package main

import (
	"fmt"
	"log"
	"os"
	"runtime"
	"runtime/pprof"
	"sync"
	"time"
)

// DebugInfo holds debugging context
type DebugInfo struct {
	StartTime time.Time
	Traces    []string
	mu        sync.Mutex
}

// Global debug info
var debugInfo = &DebugInfo{
	StartTime: time.Now(),
	Traces:    make([]string, 0),
}

// Trace adds a trace message with timestamp
func (d *DebugInfo) Trace(format string, args ...interface{}) {
	d.mu.Lock()
	defer d.mu.Unlock()
	
	elapsed := time.Since(d.StartTime)
	message := fmt.Sprintf(format, args...)
	trace := fmt.Sprintf("[%.3fs] %s", elapsed.Seconds(), message)
	
	d.Traces = append(d.Traces, trace)
	
	// Only print in debug mode
	if os.Getenv("DEBUG") == "1" {
		fmt.Println(trace)
	}
}

// DumpTraces writes all traces to stdout
func (d *DebugInfo) DumpTraces() {
	d.mu.Lock()
	defer d.mu.Unlock()
	
	fmt.Println("\n=== Debug Traces ===")
	for _, trace := range d.Traces {
		fmt.Println(trace)
	}
}

// DumpStack captures and prints stack trace
func DumpStack() {
	buf := make([]byte, 4096)
	n := runtime.Stack(buf, true)
	fmt.Printf("\n=== Stack Trace ===\n%s\n", buf[:n])
}

// StartCPUProfile begins CPU profiling
func StartCPUProfile(filename string) {
	f, err := os.Create(filename)
	if err != nil {
		log.Fatalf("Could not create CPU profile: %v", err)
	}
	if err := pprof.StartCPUProfile(f); err != nil {
		log.Fatalf("Could not start CPU profile: %v", err)
	}
}

// StopCPUProfile stops CPU profiling
func StopCPUProfile() {
	pprof.StopCPUProfile()
}

// Sample function with a bug
func buggyFunction(n int) int {
	debugInfo.Trace("buggyFunction(%d) called", n)
	
	if n <= 0 {
		debugInfo.Trace("buggyFunction: invalid input %d", n)
		return 0
	}
	
	// Bug: off-by-one error in loop bound
	result := 0
	for i := 0; i <= n; i++ {  // Should be i < n
		result += i
	}
	
	debugInfo.Trace("buggyFunction returning %d", result)
	return result
}

// Function with data race
func dataRaceFunction() {
	debugInfo.Trace("dataRaceFunction called")
	
	// Shared counter without proper synchronization
	counter := 0
	var wg sync.WaitGroup
	
	for i := 0; i < 1000; i++ {
		wg.Add(1)
		go func() {
			// Race condition here
			counter++
			wg.Done()
		}()
	}
	
	wg.Wait()
	debugInfo.Trace("dataRaceFunction counter: %d", counter)
}

// Main function
func main() {
	// Start CPU profiling if requested
	if os.Getenv("PROFILE") == "1" {
		StartCPUProfile("cpu.prof")
		defer StopCPUProfile()
	}
	
	// Register handler for SIGQUIT to dump stack trace
	// This can be triggered with Ctrl+\ in Unix systems
	
	debugInfo.Trace("Program started")
	
	// Call functions with bugs for debugging demo
	result := buggyFunction(5)
	debugInfo.Trace("Main: buggyFunction result = %d", result)
	
	dataRaceFunction()
	
	// Force garbage collection for memory profiling demo
	debugInfo.Trace("Forcing garbage collection")
	runtime.GC()
	
	debugInfo.Trace("Program completed")
	debugInfo.DumpTraces()
}
