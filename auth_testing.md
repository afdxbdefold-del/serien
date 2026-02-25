# Auth-Gated App Testing Playbook

## Step 1: Create Test User & Session

```bash
# Using Node.js with Prisma
cd /app/serien-nextjs && node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createTestUser() {
  const testEmail = 'test.user.' + Date.now() + '@example.com';
  
  // Create test user
  const user = await prisma.user.create({
    data: {
      email: testEmail,
      name: 'Test User',
      password: await require('bcryptjs').hash('test123456', 10),
      role: 'user',
      image: 'https://via.placeholder.com/150'
    }
  });
  
  console.log('Test User Created:');
  console.log('Email:', user.email);
  console.log('Password: test123456');
  console.log('User ID:', user.id);
  
  await prisma.\$disconnect();
}

createTestUser().catch(console.error);
"
```

## Step 2: Test Backend API

```bash
# Get backend URL from env
API_URL=\$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d '=' -f2)

# Test login
TOKEN=\$(curl -s -X POST "\$API_URL/api/auth/login" \\
  -H "Content-Type: application/json" \\
  -d '{"email":"test.user@example.com","password":"test123456"}' \\
  | python3 -c "import sys,json;print(json.load(sys.stdin).get('token',''))")

# Test /me endpoint
curl -X GET "\$API_URL/api/auth/me" \\
  -H "Authorization: Bearer \$TOKEN"
```

## Step 3: Browser Testing with Playwright

```javascript
// Set cookie and navigate
await page.context().addCookies([{
    name: "auth-token",
    value: "YOUR_JWT_TOKEN",
    domain: "localhost",
    path: "/",
    httpOnly: true,
    secure: false,
    sameSite: "Lax"
}]);

await page.goto("http://localhost:3000/einstellungen");
await page.waitForLoadState("networkidle");
```

## Quick Debug Commands

```bash
# Check users in database
cd /app/serien-nextjs && npx prisma studio

# Or via CLI
cd /app/serien-nextjs && node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.user.findMany({ take: 5 }).then(users => {
  console.log(JSON.stringify(users, null, 2));
  prisma.\$disconnect();
});
"
```

## Success Indicators

✅ Login returns JWT token in cookie
✅ /api/auth/me returns user data with valid token
✅ Protected pages (einstellungen) load without redirect
✅ Follow/Comment features work with real user

## Failure Indicators

❌ "Unauthorized" 401 errors
❌ Cookie not set after login
❌ Redirect to home page instead of staying on protected route
❌ User data shows null in Header
