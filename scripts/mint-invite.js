/**
 * Mint invite codes, and show what has been handed out (LOS-376).
 *
 *   node scripts/mint-invite.js                     -- lists every code
 *   node scripts/mint-invite.js --new "for Sam"     -- mints one, with a note
 *   node scripts/mint-invite.js --new "..." -n 5    -- mints five
 *
 * CommonJS, because there is no tsx on the droplet: this runs through the api
 * container against the bind-mounted scripts directory.
 *
 * Codes are read aloud and retyped, so the alphabet leaves out the characters
 * that get confused doing that -- no O/0, no I/1/l. The lookup is
 * case-insensitive for the same reason.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');

// Same .env handling as the other scripts: the app loads it through dotenv at
// startup, a standalone script has to do it itself. Existing environment wins.
const envPath = path.join(ROOT, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([^#=]+?)\s*=\s*(.*)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

const { Pool } = require('pg');

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const GROUPS = 3;
const GROUP_LEN = 4;

/**
 * randomInt rather than Math.random: a guessable invite code is not an invite
 * code. rejection-free because randomInt already handles the modulo bias.
 */
function mintCode() {
  const groups = [];
  for (let g = 0; g < GROUPS; g += 1) {
    let group = '';
    for (let i = 0; i < GROUP_LEN; i += 1) {
      group += ALPHABET[crypto.randomInt(ALPHABET.length)];
    }
    groups.push(group);
  }
  return groups.join('-');
}

async function main() {
  const args = process.argv.slice(2);
  const newIndex = args.indexOf('--new');
  const countIndex = args.indexOf('-n');
  const count = countIndex === -1 ? 1 : Math.max(1, parseInt(args[countIndex + 1], 10) || 1);
  const note = newIndex === -1 ? null : args[newIndex + 1] || null;

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    if (newIndex !== -1) {
      for (let i = 0; i < count; i += 1) {
        const code = mintCode();
        await pool.query('INSERT INTO invite_codes (code, note) VALUES ($1, $2)', [code, note]);
        console.log(code + (note ? `   (${note})` : ''));
      }
      console.log('');
    }

    const { rows } = await pool.query(
      `SELECT c.code, c.note, c.created_at, c.used_at, u.handle AS used_by
         FROM invite_codes c
         LEFT JOIN users u ON u.id = c.used_by_user_id
        ORDER BY c.created_at`,
    );

    if (rows.length === 0) {
      console.log('No invite codes yet. Mint one with --new "who it is for".');
      return;
    }

    console.log('code            state      for');
    console.log('--------------  ---------  ------------------------');
    for (const row of rows) {
      // A code whose user was later deleted keeps used_at, so it still reads as
      // spent rather than quietly becoming available again.
      const state = row.used_at ? (row.used_by ? `@${row.used_by}` : 'used') : 'unused';
      console.log(`${row.code.padEnd(14)}  ${state.padEnd(9)}  ${row.note || ''}`);
    }
    const unused = rows.filter((r) => !r.used_at).length;
    console.log(`\n${rows.length} total, ${unused} unused.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
