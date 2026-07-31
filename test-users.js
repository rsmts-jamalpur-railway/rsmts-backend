const jwt = require('jsonwebtoken');
const token = jwt.sign({userId: '00000000-0000-0000-0000-000000000000', role: 'Administrator'}, process.env.JWT_SECRET || 'super-secret-key-for-rsmts-development-environment');

fetch('http://localhost:4000/v1/users', {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json()).then(console.log);

fetch('http://localhost:4000/v1/roles', {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json()).then(console.log);
