CREATE TABLE users (  
    id INTEGER PRIMARY KEY AUTOINCREMENT,  
    username TEXT NOT NULL UNIQUE,  
    password TEXT NOT NULL,  
    role TEXT NOT NULL CHECK(role IN ('customer', 'mechanic'))  
);

CREATE TABLE tickets (
    id
)