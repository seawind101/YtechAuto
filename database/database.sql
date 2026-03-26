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
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    color TEXT NOT NULL,
    Vin TEXT NOT NULL,
    mfgDate TEXT NOT NULL,
    engineSize TEXT NOT NULL,
    transType TEXT NOT NULL,
    currentMileage INTEGER NOT NULL,
    oldMileage INTEGER NOT NULL,
    carDate TEXT NOT NULL,
    plate TEXT NOT NULL,
    carYear INTEGER NOT NULL
);

CREATE TABLE courtesy (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticketID INTEGER NOT NULL,
    partName TEXT NOT NULL,
    status TEXT NOT NULL,
    notes TEXT
);

CREATE TABLE tires (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticketID INTEGER NOT NULL,
    size TEXT NOT NULL,
    speedRating REAL NOT NULL,
    leftFrontTread REAL NOT NULL,
    rightFrontTread REAL NOT NULL,
    leftRearTread REAL NOT NULL,
    rightRearTread REAL NOT NULL,
    spare REAL NOT NULL,
    treadDepth REAL NOT NULL,
    rotaitionNeeded TEXT NOT NULL,
    BalanceNeeded TEXT NOT NULL,
    alignmentNeeded TEXT NOT NULL,
    notes TEXT
);

CREATE TABLE steering_suspension (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticketID INTEGER NOT NULL,
    item TEXT NOT NULL,
    left TEXT NOT NULL,
    right TEXT NOT NULL,
    notes TEXT
);





-- INSERT INTO courtesy (ticketID, partName, status, notes)
-- VALUES
-- (2, 'Brakes', 'Needs Service', 'Brake pads are worn.'),
-- (2, 'Engine', 'OK', ''),
-- (2, 'Tires', 'Monitor Soon', 'Tread is wearing thin.');