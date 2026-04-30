const jwt = require('jsonwebtoken');
const fs = require('fs');
const env = fs.readFileSync('.env','utf8');
const secret = env.match(/JWT_SECRET="([^"]+)"/)[1];
const t = jwt.sign({ role: 'admin', email: 'admin@serien.de' }, secret, { expiresIn: '1h' });
console.log(t);
