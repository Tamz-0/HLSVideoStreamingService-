#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const { Pool } = require('pg');

require('dotenv').config();

async function runMigrations() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('Starting database migrations...');
    
    // Read and execute init.sql
    const initSqlPath = path.join(__dirname, '../database/init.sql');
    const initSql = await fs.readFile(initSqlPath, 'utf8');
    
    await pool.query(initSql);
    
    console.log('Database migrations completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  runMigrations();
}

module.exports = runMigrations;
