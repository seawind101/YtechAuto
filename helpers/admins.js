const raw = process.env.ADMIN || '';


const parseAdmins = (text) => {
  if (!text) return [];
  // Remove surrounding brackets and quotes
  let s = String(text).trim();
  s = s.replace(/^\[|\]$/g, '').replace(/^["']|["']$/g, '');
  return s
    .split(',')
    .map((e) => (e || '').toString().trim().toLowerCase())
    .filter(Boolean);
};

const admins = parseAdmins(raw);

// optional: log parsed admin list for debugging (remove when confirmed)
console.log('admin list from env:', admins);

function isAdmin(email) {
  if (!email) return false;
  return admins.includes(String(email).toLowerCase().trim());
}

module.exports = { admins, isAdmin };