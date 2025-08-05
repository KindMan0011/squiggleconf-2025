use std::collections::HashMap;
use std::rc::Rc;
use std::cell::RefCell;

// Structure for demonstrating memory leaks
struct Node {
    value: i32,
    // Potential circular reference causing memory leak
    children: Vec<Rc<RefCell<Node>>>,
    // Using raw pointer for demonstration
    unsafe_ptr: Option<*mut i32>,
}

impl Node {
    fn new(value: i32) -> Self {
        Node {
            value,
            children: Vec::new(),
            unsafe_ptr: None,
        }
    }
    
    fn add_child(&mut self, child: Rc<RefCell<Node>>) {
        self.children.push(child);
    }
    
    // Unsafe method for demonstration
    unsafe fn set_unsafe_ptr(&mut self, ptr: *mut i32) {
        self.unsafe_ptr = Some(ptr);
    }
    
    // Potentially dangerous operation
    unsafe fn modify_through_ptr(&self) {
        if let Some(ptr) = self.unsafe_ptr {
            *ptr += 10;
        }
    }
}

// Function with a use-after-free bug
fn use_after_free_example() {
    let mut data = Box::new(42);
    let data_ptr = &mut *data as *mut i32;
    
    // Use the data
    println!("Data value: {}", *data);
    
    // Drop the Box, freeing the memory
    drop(data);
    
    // Attempt to use the freed memory (undefined behavior)
    unsafe {
        // This line would cause a use-after-free if uncommented
        // println!("After free: {}", *data_ptr);
    }
}

// Function with potential memory leak
fn create_circular_reference() -> Rc<RefCell<Node>> {
    let node1 = Rc::new(RefCell::new(Node::new(1)));
    let node2 = Rc::new(RefCell::new(Node::new(2)));
    
    // Create circular reference
    node1.borrow_mut().add_child(Rc::clone(&node2));
    node2.borrow_mut().add_child(Rc::clone(&node1));
    
    // Return node1, but node2 is also kept alive due to circular reference
    node1
}

// Function with a double-free issue
fn double_free_example() {
    unsafe {
        // Allocate memory
        let ptr = Box::into_raw(Box::new(5));
        
        // Use the memory
        println!("Value: {}", *ptr);
        
        // Free it once properly
        let _ = Box::from_raw(ptr);
        
        // Uncommenting would cause a double-free error
        // let _ = Box::from_raw(ptr);
    }
}

// Function with iterator invalidation
fn iterator_invalidation() {
    let mut numbers = vec![1, 2, 3, 4, 5];
    
    // Safe way to modify while iterating
    for i in 0..numbers.len() {
        if numbers[i] % 2 == 0 {
            numbers[i] *= 2;
        }
    }
    
    println!("Safe modification: {:?}", numbers);
    
    // Unsafe modification that would invalidate iterators if uncommented
    /*
    let mut iter = numbers.iter_mut();
    while let Some(num) = iter.next() {
        if *num > 3 {
            numbers.push(*num * 2); // This would invalidate the iterator
        }
    }
    */
}

fn main() {
    // Memory leak example
    let _leaked_ref = create_circular_reference();
    println!("Created circular reference");
    
    // Use after free example (commented out to prevent UB)
    use_after_free_example();
    
    // Double free example (partially commented out to prevent UB)
    double_free_example();
    
    // Iterator invalidation example
    iterator_invalidation();
    
    // Unsafe pointer example
    let mut value = 42;
    let mut node = Node::new(100);
    
    unsafe {
        node.set_unsafe_ptr(&mut value);
        println!("Before modification: {}", value);
        node.modify_through_ptr();
        println!("After modification: {}", value);
    }
    
    // Example of leaking memory with HashMap
    let mut cache = HashMap::new();
    for i in 0..1000 {
        let key = format!("key_{}", i);
        let value = vec![0; 1024]; // 1KB of data
        cache.insert(key, value);
    }
    
    println!("Cache size: {}", cache.len());
    
    // To demonstrate memory leaks, we'll just forget about the cache
    std::mem::forget(cache);
    
    println!("Memory analysis complete");
}
