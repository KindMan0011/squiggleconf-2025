#[derive(Debug)]
struct User {
    id: u64,
    name: String,
    email: String,
    active: bool,
}

impl User {
    fn new(id: u64, name: &str, email: &str) -> Self {
        User {
            id,
            name: name.to_string(),
            email: email.to_string(),
            active: true,
        }
    }
    
    fn deactivate(&mut self) {
        self.active = false;
    }
}

// A function with a bug for debugging practice
fn find_user_by_id(users: &[User], id: u64) -> Option<&User> {
    // Bug: Off-by-one error in the loop bound
    for i in 0..users.len() - 1 { // Should be just users.len()
        if users[i].id == id {
            return Some(&users[i]);
        }
    }
    None
}

// A function with memory safety issues for demonstration
fn unsafe_example() {
    let mut data = vec![1, 2, 3, 4, 5];
    
    unsafe {
        // Get a raw pointer to the data
        let ptr = data.as_mut_ptr();
        
        // Modify values through the pointer
        for i in 0..data.len() {
            *ptr.add(i) = i as i32 * 10;
        }
        
        // Potential undefined behavior for demonstration:
        // Uncommenting this would access out of bounds memory
        // *ptr.add(data.len()) = 100;
    }
    
    println!("Modified data: {:?}", data);
}

fn main() {
    // Create a collection of users
    let mut users = vec![
        User::new(1, "Alice", "alice@example.com"),
        User::new(2, "Bob", "bob@example.com"),
        User::new(3, "Charlie", "charlie@example.com"),
        User::new(4, "Diana", "diana@example.com"),
    ];
    
    // Deactivate one user
    if let Some(user) = users.get_mut(1) {
        user.deactivate();
    }
    
    // Attempt to find users - the last one will fail due to the bug
    let found_user1 = find_user_by_id(&users, 1);
    let found_user2 = find_user_by_id(&users, 2);
    let found_user4 = find_user_by_id(&users, 4); // This will fail due to the bug
    
    println!("User 1: {:?}", found_user1);
    println!("User 2: {:?}", found_user2);
    println!("User 4: {:?}", found_user4); // Will print None due to the bug
    
    // Demonstrate unsafe code for debugging
    unsafe_example();
    
    // Heap allocation and memory usage example
    let mut big_vec = Vec::with_capacity(1000);
    for i in 0..1000 {
        big_vec.push(i * i);
    }
    
    println!("Vector size: {}", big_vec.len());
    println!("Vector capacity: {}", big_vec.capacity());
    
    // Trigger a potential memory leak for demonstration
    std::mem::forget(big_vec);
}
