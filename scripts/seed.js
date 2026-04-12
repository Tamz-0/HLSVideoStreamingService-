#!/usr/bin/env node

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

require('dotenv').config();

async function seedDatabase() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('Starting database seeding...');
    
    // Create test users
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    const users = [
      {
        username: 'testcreator',
        email: 'creator@test.com',
        role: 'creator'
      },
      {
        username: 'testuser',
        email: 'user@test.com',
        role: 'user'
      }
    ];

    for (const user of users) {
      await pool.query(`
        INSERT INTO users (username, email, password_hash, role, is_verified)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (email) DO NOTHING
      `, [user.username, user.email, hashedPassword, user.role, true]);
    }

    // Create sample playlists
    const playlistQuery = `
      INSERT INTO playlists (user_id, name, description, is_public)
      SELECT u.id, $1, $2, $3
      FROM users u
      WHERE u.email = $4
      ON CONFLICT DO NOTHING
    `;

    await pool.query(playlistQuery, [
      'My Favorites',
      'A collection of my favorite videos',
      true,
      'creator@test.com'
    ]);

    await pool.query(playlistQuery, [
      'Watch Later',
      'Videos to watch later',
      false,
      'user@test.com'
    ]);

    console.log('Database seeding completed successfully!');
    
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;
