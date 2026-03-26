CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
);

CREATE TABLE tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    techName TEXT NOT NULL,
    timeIn TEXT NOT NULL,
    timeOut TEXT,
    totalTime TEXT NOT NULL,
    customerName TEXT NOT NULL,
    customerAddress TEXT NOT NULL,
    customerPhone TEXT NOT NULL,
    customerEmail TEXT NOT NULL,
    concern TEXT NOT NULL,
    diagnosis TEXT NOT NULL,
    recommendedRepairs TEXT NOT NULL,
    dateSigned TEXT NOT NULL,
    customerSignature TEXT NOT NULL
);

CREATE TABLE recRepairs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticketId INTEGER NOT NULL,
    repairDescription TEXT NOT NULL,
    qty INTEGER NOT NULL,
    partNumber TEXT NOT NULL,
    partPrice REAL NOT NULL,
    partsTotal REAL NOT NULL,
    laborHours REAL NOT NULL,
    laborTotal REAL NOT NULL
);

CREATE TABLE vechicleInfo (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticketID INTEGER NOT NULL,
    item TEXT NOT NULL,
    input TEXT NOT NULL
);

CREATE TABLE courtesyTable (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticketID INTEGER NOT NULL,
    item TEXT NOT NULL,
    status TEXT NOT NULL,
    notes TEXT
);

CREATE TABLE tires (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticketID INTEGER NOT NULL,
    item TEXT NOT NULL,
    input TEXT NOT NULL
);

CREATE TABLE steeringSupensionTable (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticketID INTEGER NOT NULL,
    item TEXT NOT NULL,
    left TEXT,
    right TEXT,
    front TEXT,
    rear TEXT,
    notes TEXT
);

CREATE TABLE brakesTable (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticketID INTEGER NOT NULL,
    item TEXT NOT NULL,
    Spec TEXT NOT NULL,
    actual TEXT NOT NULL,
    status TEXT,
    notes TEXT
);

CREATE TABLE emissionsTable (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticketID INTEGER NOT NULL,
    item TEXT NOT NULL,
    status TEXT NOT NULL,
    notes TEXT 
);

CREATE TABLE emissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticketID INTEGER NOT NULL,
    item TEXT NOT NULL,
    input TEXT NOT NULL
);

CREATE TABLE signitures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticketID INTEGER NOT NULL,

);

-- "uploads/ filenamefromdb" + ".png"

-- INSERT INTO courtesy (ticketID, partName, status, notes)
-- VALUES
-- (2, 'Brakes', 'Needs Service', 'Brake pads are worn.'),
-- (2, 'Tires', 'Monitor Soon', 'Tread is wearing thin.');