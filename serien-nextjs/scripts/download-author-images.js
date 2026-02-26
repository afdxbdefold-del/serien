const { PrismaClient } = require('@prisma/client');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const stream = require('stream');
const pipeline = promisify(stream.pipeline);

const prisma = new PrismaClient();

// Create authors directory if it doesn't exist
const authorsDir = path.join(__dirname, '../public/authors');
if (!fs.existsSync(authorsDir)) {
  fs.mkdirSync(authorsDir, { recursive: true });
  console.log('✓ Created /public/authors directory');
}

async function downloadImage(url, filename) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    protocol.get(url, (response) => {
      if (response.statusCode === 200) {
        const filePath = path.join(authorsDir, filename);
        const fileStream = fs.createWriteStream(filePath);
        
        response.pipe(fileStream);
        
        fileStream.on('finish', () => {
          fileStream.close();
          resolve(filePath);
        });
      } else {
        reject(new Error(`Failed to download: ${response.statusCode}`));
      }
    }).on('error', reject);
  });
}

async function downloadAuthorImages() {
  console.log('🔄 Starting author image download...\n');
  
  // Get all users with images
  const users = await prisma.user.findMany({
    where: {
      image: {
        not: null,
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
    },
  });
  
  console.log(`Found ${users.length} users with profile images\n`);
  
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;
  
  for (const user of users) {
    try {
      // Skip if already local
      if (user.image && user.image.startsWith('/authors/')) {
        console.log(`⏭️  Skipping ${user.name} - already local`);
        skipped++;
        continue;
      }
      
      // Generate filename from user ID
      const ext = user.image?.includes('.jpg') ? 'jpg' : 'jpeg';
      const filename = `${user.id}.${ext}`;
      const localPath = `/authors/${filename}`;
      
      console.log(`📥 Downloading: ${user.name}`);
      console.log(`   From: ${user.image?.substring(0, 60)}...`);
      
      await downloadImage(user.image, filename);
      
      // Update database
      await prisma.user.update({
        where: { id: user.id },
        data: { image: localPath },
      });
      
      console.log(`✅ Saved to: ${localPath}\n`);
      downloaded++;
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      console.error(`❌ Failed for ${user.name}: ${error.message}\n`);
      failed++;
    }
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 Summary:');
  console.log(`   ✅ Downloaded: ${downloaded}`);
  console.log(`   ⏭️  Skipped: ${skipped}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log('='.repeat(50));
}

downloadAuthorImages()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
