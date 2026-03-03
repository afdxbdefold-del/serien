import fs from 'fs';
import path from 'path';

const filesToFix = [
  './app/figuren/page.tsx',
  './app/admin/discover/[articleId]/page.tsx',
  './app/redaktion/page.tsx',
  './app/person/[id]/page.tsx',
  './app/genre/[genre]/page.tsx',
  './app/personen/page.tsx',
  './app/figur/[slug]/page.tsx',
  './app/streamer/[streamer]/page.tsx',
  './app/serienfinder/page.tsx',
];

const dynamicExport = "\n// Force dynamic rendering\nexport const dynamic = 'force-dynamic';\n";

for (const file of filesToFix) {
  const fullPath = path.join(process.cwd(), file);
  
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf-8');
    
    if (!content.includes('export const dynamic')) {
      // Add after imports
      const lines = content.split('\n');
      let lastImportIndex = -1;
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('import ')) {
          lastImportIndex = i;
        } else if (lastImportIndex !== -1 && !lines[i].startsWith('import')) {
          break;
        }
      }
      
      if (lastImportIndex !== -1) {
        lines.splice(lastImportIndex + 1, 0, dynamicExport);
        fs.writeFileSync(fullPath, lines.join('\n'));
        console.log('✅ Fixed:', file);
      }
    } else {
      console.log('⏭️  Already has dynamic:', file);
    }
  } else {
    console.log('❌ Not found:', file);
  }
}

console.log('\n✅ Done! All pages now have dynamic export.');
