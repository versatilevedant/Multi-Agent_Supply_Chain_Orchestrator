const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'blood_bank.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initDatabase();
    }
});

function initDatabase() {
    db.serialize(() => {
        // Create Blood Banks Table
        db.run(`CREATE TABLE IF NOT EXISTS blood_banks (
            id TEXT PRIMARY KEY,
            name TEXT,
            city TEXT,
            state TEXT,
            lat REAL,
            lng REAL,
            type TEXT,
            capacity INTEGER,
            status TEXT DEFAULT 'operational'
        )`);

        // Create Inventory Table
        db.run(`CREATE TABLE IF NOT EXISTS inventory (
            bank_id TEXT,
            blood_group TEXT,
            units INTEGER,
            capacity INTEGER,
            last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (bank_id, blood_group),
            FOREIGN KEY(bank_id) REFERENCES blood_banks(id)
        )`);

        // Create Hospitals Table
        db.run(`CREATE TABLE IF NOT EXISTS hospitals (
            id TEXT PRIMARY KEY,
            name TEXT,
            city TEXT,
            lat REAL,
            lng REAL
        )`);

        // Create Emergencies Table
        db.run(`CREATE TABLE IF NOT EXISTS emergencies (
            id TEXT PRIMARY KEY,
            hospital_id TEXT,
            blood_group TEXT,
            units INTEGER,
            condition TEXT,
            status TEXT DEFAULT 'pending',
            urgency_score REAL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(hospital_id) REFERENCES hospitals(id)
        )`);

        checkAndSeedData();
    });
}

function checkAndSeedData() {
    db.get("SELECT COUNT(*) AS count FROM blood_banks", (err, row) => {
        if (err) {
            console.error(err.message);
            return;
        }
        if (row.count === 0) {
            console.log('Seeding initial data...');
            seedData();
        } else {
            console.log('Database already seeded.');
        }
    });
}

function seedData() {
    const fs = require('fs');
    let bloodBanksData = [];
    let hospitalsData = [];

    try {
        bloodBanksData = JSON.parse(fs.readFileSync(path.join(__dirname, 'config', 'bloodBanks.json'), 'utf8'));
        hospitalsData = JSON.parse(fs.readFileSync(path.join(__dirname, 'config', 'hospitals.json'), 'utf8'));
    } catch (e) {
        console.error("Failed to load JSON config for SQLite seeding:", e);
    }

    const stmt = db.prepare(`INSERT OR REPLACE INTO blood_banks (id, name, city, state, type, lat, lng, capacity) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    bloodBanksData.forEach(b => {
        stmt.run(b.id, b.name, b.city, b.state || '', b.type || 'Government', b.lat, b.lng, b.capacity || 400);
    });
    stmt.finalize();

    const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
    const invStmt = db.prepare(`INSERT OR REPLACE INTO inventory (bank_id, blood_group, units, capacity) VALUES (?, ?, ?, ?)`);
    
    bloodBanksData.forEach(b => {
        bloodGroups.forEach(bg => {
            const units = Math.floor(Math.random() * 35) + 5;
            const cap = Math.floor((b.capacity || 400) / 8);
            invStmt.run(b.id, bg, units, cap);
        });
    });
    invStmt.finalize();

    const hStmt = db.prepare(`INSERT OR REPLACE INTO hospitals (id, name, city, lat, lng) VALUES (?, ?, ?, ?, ?)`);
    hospitalsData.forEach(h => {
        hStmt.run(h.id, h.name, h.city, h.lat, h.lng);
    });
    hStmt.finalize();
    console.log(`[SQLite Database] Seeded ${bloodBanksData.length} blood banks and ${hospitalsData.length} hospitals successfully.`);
}

module.exports = db;
