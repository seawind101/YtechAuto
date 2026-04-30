CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    stat text
);
 
CREATE TABLE tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repairOrderNumber TEXT NOT NULL UNIQUE,
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
    customerSignature TEXT,
    stat TEXT
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
    yearV TEXT NOT NULL,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    Color TEXT NOT NULL,
    vin TEXT NOT NULL,
    mfgDate TEXT NOT NULL,
    engineSize TEXT NOT NULL,
    transType TEXT NOT NULL,
    mileageC TEXT NOT NULL,
    mileageO TEXT NOT NULL,
    dateV TEXT NOT NULL,
    plate TEXT NOT NULL,
    comments TEXT
);
 
CREATE TABLE courtesyTable (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticketID INTEGER NOT NULL,
    item TEXT NOT NULL,
    comments TEXT
);
 
CREATE TABLE courtesyTableItems (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tableID INTEGER NOT NULL,
    item TEXT NOT NULL,
    status TEXT NOT NULL,
    notes TEXT
);
 
CREATE TABLE tires (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticketID INTEGER NOT NULL,
    size TEXT NOT NULL,
    speedRating TEXT NOT NULL,
    LF TEXT NOT NULL,
    RF TEXT NOT NULL,
    LR TEXT NOT NULL,
    RR TEXT NOT NULL,
    SP TEXT NOT NULL,
    treadDepth32 TEXT NOT NULL,
    rotationDue TEXT NOT NULL,
    balance TEXT NOT NULL,
    alignment TEXT NOT NULL,
    comments TEXT
);
 
CREATE TABLE steeringSuspension (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticketID INTEGER NOT NULL,
    item TEXT NOT NULL,
    comments
);
 
CREATE TABLE steeringSuspensionTable (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    steeringSuspensionID INTEGER NOT NULL,
    item TEXT NOT NULL,
    left TEXT,
    right TEXT,
    front TEXT,
    rear TEXT
);
 
CREATE TABLE brakes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticketID INTEGER NOT NULL,
    item TEXT NOT NULL,
    comments
);
 
CREATE TABLE brakesTable (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brakesID INTEGER NOT NULL,
    item TEXT NOT NULL,
    Spec TEXT,
    actual TEXT
);
 
CREATE TABLE emissionsTable (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    emissionsID INTEGER NOT NULL,
    item TEXT NOT NULL,
    status TEXT NOT NULL,
    notes TEXT
);
 
CREATE TABLE emissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticketID INTEGER NOT NULL,
    OBD TEXT NOT NULL,
    inspections TEXT NOT NULL,
    emissionsDue TEXT NOT NULL,
    nextOilChange TEXT NOT NULL,
    inspectedBy TEXT NOT NULL,
    reInspectedBy TEXT NOT NULL,
    comments TEXT
);
 
CREATE TABLE warningsTable (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    emissionsID INTEGER NOT NULL,
    item TEXT NOT NULL
);
 
CREATE TABLE pictures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticketID INTEGER,
    filename TEXT NOT NULL,
    originalName TEXT NOT NULL,
    relativePath TEXT NOT NULL,
    mimeType TEXT NOT NULL,
    sizeBytes INTEGER NOT NULL,
    uploadDate TEXT DEFAULT (datetime('now'))
);
 
CREATE TABLE videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticketID INTEGER,
    filename TEXT NOT NULL,
    originalName TEXT NOT NULL,
    relativePath TEXT NOT NULL,
    mimeType TEXT NOT NULL,
    sizeBytes INTEGER NOT NULL,
    uploadDate TEXT DEFAULT (datetime('now'))
);
 
CREATE TABLE signatures (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticketID INTEGER,
    filename TEXT NOT NULL,
    originalName TEXT NOT NULL,
    relativePath TEXT NOT NULL,
    uploadDate TEXT DEFAULT (datetime('now'))
)
 
-- "uploads/ filenamefromdb" + ".png"
 
-- INSERT INTO courtesy (ticketID, partName, status, notes)
-- VALUES
-- (2, 'Brakes', 'Needs Service', 'Brake pads are worn.'),
-- (2, 'Tires', 'Monitor Soon', 'Tread is wearing thin.');