use std::sync::{Arc, Mutex};
use std::time::Duration;
use std::fmt;

// A simple logger for tracing async execution
struct AsyncLogger {
    log: Arc<Mutex<Vec<String>>>,
}

impl AsyncLogger {
    fn new() -> Self {
        AsyncLogger {
            log: Arc::new(Mutex::new(Vec::new())),
        }
    }
    
    fn log(&self, message: &str) {
        let mut log = self.log.lock().unwrap();
        log.push(format!("{}: {}", chrono::Local::now().format("%H:%M:%S.%3f"), message));
    }
    
    fn dump_log(&self) {
        let log = self.log.lock().unwrap();
        println!("=== Async Execution Log ===");
        for entry in log.iter() {
            println!("{}", entry);
        }
        println!("===========================");
    }
    
    fn clone(&self) -> Self {
        AsyncLogger {
            log: Arc::clone(&self.log),
        }
    }
}

// Custom future wrapper for debugging
struct DebugFuture<F> {
    inner: F,
    name: &'static str,
    logger: AsyncLogger,
}

impl<F> DebugFuture<F> {
    fn new(future: F, name: &'static str, logger: AsyncLogger) -> Self {
        DebugFuture {
            inner: future,
            name,
            logger,
        }
    }
}

impl<F: std::future::Future> std::future::Future for DebugFuture<F> {
    type Output = F::Output;
    
    fn poll(self: std::pin::Pin<&mut Self>, cx: &mut std::task::Context<'_>) -> std::task::Poll<Self::Output> {
        // Safety: we're not moving any fields out of self
        let this = unsafe { self.get_unchecked_mut() };
        this.logger.log(&format!("Polling future '{}'", this.name));
        
        // Safety: we're not moving the inner future out of self
        let inner = unsafe { std::pin::Pin::new_unchecked(&mut this.inner) };
        match inner.poll(cx) {
            std::task::Poll::Ready(result) => {
                this.logger.log(&format!("Future '{}' completed", this.name));
                std::task::Poll::Ready(result)
            },
            std::task::Poll::Pending => {
                this.logger.log(&format!("Future '{}' pending", this.name));
                std::task::Poll::Pending
            }
        }
    }
}

// Helper function to create a debuggable future
fn debug_future<F: std::future::Future>(future: F, name: &'static str, logger: AsyncLogger) -> DebugFuture<F> {
    DebugFuture::new(future, name, logger)
}

// Simulated async tasks
async fn fetch_data(id: u32, logger: AsyncLogger) -> Result<String, &'static str> {
    logger.log(&format!("Starting fetch_data({})", id));
    
    // Simulate network delay
    tokio::time::sleep(Duration::from_millis(id * 100)).await;
    
    // Simulate occasional failure
    if id % 5 == 0 {
        logger.log(&format!("fetch_data({}) failed", id));
        return Err("Data fetch failed");
    }
    
    logger.log(&format!("fetch_data({}) succeeded", id));
    Ok(format!("Data for id {}", id))
}

async fn process_data(data: String, logger: AsyncLogger) -> String {
    logger.log(&format!("Starting process_data({})", data));
    
    // Simulate processing time
    tokio::time::sleep(Duration::from_millis(300)).await;
    
    let result = format!("Processed: {}", data);
    logger.log(&format!("Finished process_data: {}", result));
    result
}

// Task with a bug (deadlock potential)
async fn buggy_task(shared_data: Arc<Mutex<Vec<u32>>>, logger: AsyncLogger) {
    logger.log("Starting buggy_task");
    
    // Lock the mutex
    let mut data = shared_data.lock().unwrap();
    logger.log("Acquired lock in buggy_task");
    
    // This await while holding the lock could cause deadlocks in a real app
    // since we're holding the lock across an await point
    tokio::time::sleep(Duration::from_millis(500)).await;
    
    data.push(42);
    logger.log("Updated shared data and releasing lock");
    // Lock is automatically released when data goes out of scope
}

// Correct task (doesn't hold lock across await points)
async fn correct_task(shared_data: Arc<Mutex<Vec<u32>>>, logger: AsyncLogger) {
    logger.log("Starting correct_task");
    
    // Do async work before acquiring the lock
    tokio::time::sleep(Duration::from_millis(500)).await;
    
    // Acquire lock only when needed and release immediately
    {
        let mut data = shared_data.lock().unwrap();
        logger.log("Acquired lock in correct_task");
        data.push(100);
        logger.log("Updated shared data and releasing lock");
    } // Lock is released here
    
    // Continue with more async work if needed
    tokio::time::sleep(Duration::from_millis(200)).await;
    logger.log("Completed correct_task");
}

#[tokio::main]
async fn main() {
    let logger = AsyncLogger::new();
    logger.log("Starting async debugging demo");
    
    // 1. Basic async task debugging
    let fetch_future = debug_future(
        fetch_data(42, logger.clone()),
        "fetch_data",
        logger.clone()
    );
    
    let result = fetch_future.await;
    match result {
        Ok(data) => {
            logger.log(&format!("Successfully fetched data: {}", data));
            
            let process_future = debug_future(
                process_data(data, logger.clone()),
                "process_data",
                logger.clone()
            );
            
            let processed = process_future.await;
            logger.log(&format!("Final result: {}", processed));
        },
        Err(e) => logger.log(&format!("Error fetching data: {}", e)),
    }
    
    // 2. Multiple concurrent tasks
    logger.log("Starting concurrent tasks");
    
    let shared_data = Arc::new(Mutex::new(Vec::new()));
    
    let task1 = tokio::spawn(buggy_task(Arc::clone(&shared_data), logger.clone()));
    let task2 = tokio::spawn(correct_task(Arc::clone(&shared_data), logger.clone()));
    
    // Wait for both tasks to complete
    let _ = tokio::join!(task1, task2);
    
    // Check final state
    let data = shared_data.lock().unwrap();
    logger.log(&format!("Final shared data: {:?}", *data));
    
    // 3. Race condition demonstration with tokio tasks
    let counter = Arc::new(Mutex::new(0));
    let mut handles = Vec::new();
    
    for i in 0..5 {
        let counter_clone = Arc::clone(&counter);
        let logger_clone = logger.clone();
        let handle = tokio::spawn(async move {
            logger_clone.log(&format!("Task {} starting", i));
            
            // Simulate some async work
            tokio::time::sleep(Duration::from_millis(100)).await;
            
            // Update the counter (correctly with a mutex)
            let mut count = counter_clone.lock().unwrap();
            *count += 1;
            logger_clone.log(&format!("Task {} incremented counter to {}", i, *count));
        });
        
        handles.push(handle);
    }
    
    // Wait for all tasks to complete
    for handle in handles {
        let _ = handle.await;
    }
    
    // Final counter value
    let final_count = *counter.lock().unwrap();
    logger.log(&format!("Final counter value: {}", final_count));
    
    // Dump the execution log
    logger.dump_log();
}
