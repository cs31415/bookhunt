const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([^#=]+?)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

const { Pool } = require(path.join(__dirname, '..', 'api', 'node_modules', 'pg'));

const DATABASE_URL = process.env.DATABASE_URL;

async function main() {
  const email = process.argv[2];

  if (!email) {
    console.error('Usage: node scripts/wipe-user.js <email>');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: DATABASE_URL });

  try {
    // Look up the user first
    const { rows } = await pool.query(
      'SELECT id, email, display_name, created_at FROM users WHERE email = $1',
      [email],
    );

    if (rows.length === 0) {
      console.error(`No user found with email: ${email}`);
      process.exit(1);
    }

    const user = rows[0];
    console.log('Found user:');
    console.log(`  ID:      ${user.id}`);
    console.log(`  Email:   ${user.email}`);
    console.log(`  Name:    ${user.display_name}`);
    console.log(`  Created: ${user.created_at}`);

    // Count library entries before deletion
    const { rows: countRows } = await pool.query(
      'SELECT COUNT(*) AS cnt FROM library_entries WHERE user_id = $1',
      [user.id],
    );
    const entryCount = parseInt(countRows[0].cnt, 10);
    console.log(`  Library entries: ${entryCount}`);

    // Delete the user (library_entries cascade via ON DELETE CASCADE)
    await pool.query('DELETE FROM users WHERE id = $1', [user.id]);

    console.log(`\nDeleted user ${user.email} and ${entryCount} library entry/entries.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
