const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const projectRoot = path.resolve(__dirname, '..');
const databaseFolder = path.join(projectRoot, 'database');
const defaultSource = path.join(databaseFolder, 'database.sqlite');
const defaultDestination = path.join(databaseFolder, 'migrated-tickets.sqlite');
const mediaRoots = [projectRoot, path.join(projectRoot, 'upload'), path.join(projectRoot, 'uploads')];
const managedMediaDirectories = [
    path.join(projectRoot, 'upload', 'Images'),
    path.join(projectRoot, 'upload', 'videos'),
    path.join(projectRoot, 'upload', 'signatures')
];

const ticketTables = [
    { name: 'tickets', where: 'id' },
    { name: 'recRepairs', where: 'ticketId' },
    { name: 'vechicleInfo', where: 'ticketID' },
    { name: 'courtesyTable', where: 'ticketID' },
    { name: 'tires', where: 'ticketID' },
    { name: 'steeringSuspension', where: 'ticketID' },
    { name: 'brakes', where: 'ticketID' },
    { name: 'emissions', where: 'ticketID' },
    { name: 'pictures', where: 'ticketID' },
    { name: 'videos', where: 'ticketID' },
    { name: 'signatures', where: 'ticketID' }
];

const nestedTables = [
    { name: 'courtesyTableItems', parent: 'courtesyTable', foreignKey: 'tableID' },
    { name: 'steeringSuspensionTable', parent: 'steeringSuspension', foreignKey: 'steeringSuspensionID' },
    { name: 'brakesTable', parent: 'brakes', foreignKey: 'brakesID' },
    { name: 'emissionsTable', parent: 'emissions', foreignKey: 'emissionsID' },
    { name: 'warningsTable', parent: 'emissionsTable', foreignKey: 'emissionsID' }
];

function openDatabase(filePath) {
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(filePath, (error) => error ? reject(error) : resolve(db));
    });
}

function closeDatabase(db) {
    return new Promise((resolve, reject) => db.close((error) => error ? reject(error) : resolve()));
}

function run(db, sql, parameters = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, parameters, function onRun(error) {
            if (error) reject(error);
            else resolve(this);
        });
    });
}

function all(db, sql, parameters = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, parameters, (error, rows) => error ? reject(error) : resolve(rows));
    });
}

function quoteIdentifier(identifier) {
    return `"${identifier.replace(/"/g, '""')}"`;
}

function parseIds(value) {
    const ids = String(value).split(/[\s,]+/)
        .map((part) => Number(part.trim()))
        .filter((id) => Number.isInteger(id) && id > 0);
    return [...new Set(ids)];
}

function parseArguments(argumentsList) {
    const options = {
        source: process.env.npm_config_source ? path.resolve(process.env.npm_config_source) : defaultSource,
        destination: process.env.npm_config_output ? path.resolve(process.env.npm_config_output) : defaultDestination,
        ids: process.env.npm_config_ids ? parseIds(process.env.npm_config_ids) : [],
        removeSource: process.env.npm_config_remove_source === 'true',
        replaceSource: process.env.npm_config_replace_source === 'true'
    };
    const positionalIds = [];
    for (let index = 0; index < argumentsList.length; index += 1) {
        const argument = argumentsList[index];
        if (argument === '--ids') options.ids = parseIds(argumentsList[++index] || '');
        else if (argument === '--source') options.source = path.resolve(argumentsList[++index]);
        else if (argument === '--output') options.destination = path.resolve(argumentsList[++index]);
        else if (argument === '--remove-source') options.removeSource = true;
        else if (argument === '--replace-source') options.replaceSource = true;
        else if (argument === '--help' || argument === '-h') options.help = true;
        else if (/^[\d\s,]+$/.test(argument)) positionalIds.push(...parseIds(argument));
        else throw new Error(`Unknown argument: ${argument}`);
    }
    options.ids = [...new Set([...options.ids, ...positionalIds])];
    return options;
}

function printHelp() {
    console.log(`Usage: node scripts/migrateTickets.js [options]

Options:
  --ids 1,2,3          Ticket IDs to migrate. If omitted, enter them at the prompt.
  --source <file>      Source database (default: database/database.sqlite)
  --output <file>      New database (default: database/migrated-tickets.sqlite)
  --remove-source      Delete selected tickets from the source after a successful copy
    --replace-source     Delete the old database and rename the new database to database.sqlite
  --help               Show this help message

You can also edit TICKET_IDS near the bottom of this script and run it with no --ids option.`);
}

function askForIds() {
    return new Promise((resolve, reject) => {
        const input = readline.createInterface({ input: process.stdin, output: process.stdout });
        input.question('Enter ticket IDs separated by commas: ', (answer) => {
            input.close();
            const ids = parseIds(answer);
            if (ids.length === 0) reject(new Error('No valid ticket IDs were entered.'));
            else resolve(ids);
        });
    });
}

async function copyRows(destination, tableName, rows) {
    if (rows.length === 0) return;
    const columns = Object.keys(rows[0]);
    const columnSql = columns.map(quoteIdentifier).join(', ');
    const placeholders = columns.map(() => '?').join(', ');
    const insertSql = `INSERT INTO ${quoteIdentifier(tableName)} (${columnSql}) VALUES (${placeholders})`;
    for (const row of rows) await run(destination, insertSql, columns.map((column) => row[column]));
}

function findMediaPath(relativePath) {
    if (!relativePath) return null;
    for (const root of mediaRoots) {
        const candidate = path.resolve(root, relativePath);
        if (candidate.startsWith(projectRoot) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
    }
    return null;
}

function copyMediaFiles(rows, destinationRoot) {
    for (const row of rows) {
        const sourcePath = findMediaPath(row.relativePath);
        if (!sourcePath || !row.relativePath) continue;
        const targetPath = path.resolve(destinationRoot, row.relativePath);
        if (!targetPath.startsWith(destinationRoot)) continue;
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.copyFileSync(sourcePath, targetPath);
    }
}

function listFiles(directory) {
    if (!fs.existsSync(directory)) return [];
    const files = [];
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) files.push(...listFiles(entryPath));
        else if (entry.isFile()) files.push(entryPath);
    }
    return files;
}

function removeUnreferencedMedia(rows) {
    const comparePath = (filePath) => {
        const normalized = path.normalize(filePath);
        return process.platform === 'win32' ? normalized.toLowerCase() : normalized;
    };
    const referencedPaths = new Set();
    for (const row of rows) {
        if (!row.relativePath) continue;
        const referencedPath = path.resolve(projectRoot, row.relativePath);
        if (comparePath(referencedPath).startsWith(`${comparePath(projectRoot)}${path.sep}`)) {
            referencedPaths.add(comparePath(referencedPath));
        }
    }

    let removedCount = 0;
    for (const directory of managedMediaDirectories) {
        for (const filePath of listFiles(directory)) {
            if (referencedPaths.has(comparePath(filePath))) continue;
            fs.unlinkSync(filePath);
            removedCount += 1;
        }
    }
    return removedCount;
}

async function migrate(options, ticketIds) {
    if (!fs.existsSync(options.source)) throw new Error(`Source database not found: ${options.source}`);
    if (path.resolve(options.source) === path.resolve(options.destination)) throw new Error('Source and destination databases must be different files.');
    if (options.removeSource && options.replaceSource) throw new Error('Use either --remove-source or --replace-source, not both.');
    if (fs.existsSync(options.destination)) throw new Error(`Destination already exists: ${options.destination}. Choose another --output file.`);
    fs.mkdirSync(path.dirname(options.destination), { recursive: true });

    const source = await openDatabase(options.source);
    let destination;
    let migrationSucceeded = false;
    let migratedMediaRows = [];
    let migratedUsers = [];
    try {
        await run(source, 'PRAGMA foreign_keys = ON');
        const placeholders = ticketIds.map(() => '?').join(',');
        const tickets = await all(source, `SELECT * FROM tickets WHERE id IN (${placeholders}) ORDER BY id`, ticketIds);
        if (tickets.length !== ticketIds.length) {
            const found = new Set(tickets.map((ticket) => ticket.id));
            const missing = ticketIds.filter((id) => !found.has(id));
            throw new Error(`Ticket ID(s) not found: ${missing.join(', ')}`);
        }

        destination = await openDatabase(options.destination);
        await run(destination, 'PRAGMA foreign_keys = ON');
        const schemaRows = await all(source, `SELECT sql FROM sqlite_master
            WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND sql IS NOT NULL
            ORDER BY rowid`);
        const schema = schemaRows.map((row) => row.sql).join(';\n');
        await new Promise((resolve, reject) => destination.exec(schema, (error) => error ? reject(error) : resolve()));
        await run(destination, 'BEGIN TRANSACTION');
        try {
            const rowsByTable = new Map();
            const users = await all(source, 'SELECT * FROM users ORDER BY id');
            migratedUsers = users;
            await copyRows(destination, 'users', users);
            for (const table of ticketTables) {
                const rows = table.name === 'tickets'
                    ? tickets
                    : await all(source, `SELECT * FROM ${quoteIdentifier(table.name)} WHERE ${quoteIdentifier(table.where)} IN (${placeholders})`, ticketIds);
                rowsByTable.set(table.name, rows);
                await copyRows(destination, table.name, rows);
            }
            for (const table of nestedTables) {
                const parentIds = (rowsByTable.get(table.parent) || []).map((row) => row.id);
                const rows = parentIds.length === 0 ? [] : await all(source, `SELECT * FROM ${quoteIdentifier(table.name)} WHERE ${quoteIdentifier(table.foreignKey)} IN (${parentIds.map(() => '?').join(',')})`, parentIds);
                rowsByTable.set(table.name, rows);
                await copyRows(destination, table.name, rows);
            }
            await run(destination, 'COMMIT');
            migratedMediaRows = [
                ...(rowsByTable.get('pictures') || []),
                ...(rowsByTable.get('videos') || []),
                ...(rowsByTable.get('signatures') || [])
            ];
            copyMediaFiles(migratedMediaRows, projectRoot);
        } catch (error) {
            await run(destination, 'ROLLBACK').catch(() => {});
            throw error;
        }

        if (options.removeSource) {
            await run(source, 'BEGIN TRANSACTION');
            try {
                await run(source, `DELETE FROM tickets WHERE id IN (${placeholders})`, ticketIds);
                await run(source, 'COMMIT');
            } catch (error) {
                await run(source, 'ROLLBACK').catch(() => {});
                throw error;
            }
        }
        migrationSucceeded = true;
        console.log(`Migrated ticket ID(s): ${ticketIds.join(', ')}`);
        console.log(`Migrated user account(s): ${migratedUsers.length}`);
        console.log(`New database: ${options.destination}`);
        if (options.removeSource) console.log('The selected tickets were removed from the source database.');
    } finally {
        if (destination) await closeDatabase(destination);
        await closeDatabase(source);
    }

    if (options.replaceSource && migrationSucceeded) {
        const removedMediaCount = removeUnreferencedMedia(migratedMediaRows);
        fs.rmSync(options.source);
        fs.renameSync(options.destination, options.source);
        console.log(`Replaced the old database with the migrated database: ${options.source}`);
        console.log(`Removed ${removedMediaCount} unreferenced image, video, and signature file(s).`);
    }
}

async function main() {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) return printHelp();
    // Fill this array with IDs if you prefer selecting tickets in code.
    const TICKET_IDS = [];
    const ticketIds = options.ids.length > 0 ? options.ids : (TICKET_IDS.length > 0 ? TICKET_IDS : await askForIds());
    await migrate(options, ticketIds);
}

main().catch((error) => {
    console.error(`Migration failed: ${error.message}`);
    process.exitCode = 1;
});