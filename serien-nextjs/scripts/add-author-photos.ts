/**
 * Add profile photos to authors
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const AUTHOR_PHOTOS = [
  {
    email: "sophie.hartmann@serien.de",
    image: "https://images.unsplash.com/photo-1758598304332-94b40ce7c7b4?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Njd8MHwxfHNlYXJjaHwzfHxwcm9mZXNzaW9uYWwlMjB5b3VuZyUyMHdvbWFuJTIwcG9ydHJhaXQlMjBoZWFkc2hvdHxlbnwwfHx8fDE3NzIwMTY4MTJ8MA&ixlib=rb-4.1.0&q=85&w=400"
  },
  {
    email: "julia.fischer@serien.de",
    image: "https://images.unsplash.com/photo-1762522921456-cdfe882d36c3?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Njd8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjB5b3VuZyUyMHdvbWFuJTIwcG9ydHJhaXQlMjBoZWFkc2hvdHxlbnwwfHx8fDE3NzIwMTY4MTJ8MA&ixlib=rb-4.1.0&q=85&w=400"
  },
  {
    email: "laura.klein@serien.de",
    image: "https://images.pexels.com/photos/30004323/pexels-photo-30004323.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=400&w=400"
  },
  {
    email: "marie.weber@serien.de",
    image: "https://images.unsplash.com/photo-1769636929130-56648d6e9c6d?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Njd8MHwxfHNlYXJjaHw0fHxwcm9mZXNzaW9uYWwlMjB5b3VuZyUyMHdvbWFuJTIwcG9ydHJhaXQlMjBoZWFkc2hvdHxlbnwwfHx8fDE3NzIwMTY4MTJ8MA&ixlib=rb-4.1.0&q=85&w=400"
  },
  {
    email: "lena.bergmann@serien.de",
    image: "https://images.unsplash.com/photo-1602566356438-dd36d35e989c?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NjV8MHwxfHNlYXJjaHw0fHx3b21hbiUyMGpvdXJuYWxpc3QlMjB3cml0ZXIlMjBwb3J0cmFpdHxlbnwwfHx8fDE3NzIwMTY4MjB8MA&ixlib=rb-4.1.0&q=85&w=400"
  },
  {
    email: "emma.mueller@serien.de",
    image: "https://images.unsplash.com/photo-1769764615012-c0dc97167695?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NjV8MHwxfHNlYXJjaHwxfHx3b21hbiUyMGpvdXJuYWxpc3QlMjB3cml0ZXIlMjBwb3J0cmFpdHxlbnwwfHx8fDE3NzIwMTY4MjB8MA&ixlib=rb-4.1.0&q=85&w=400"
  },
  {
    email: "anna.schneider@serien.de",
    image: "https://images.unsplash.com/photo-1715618964920-5ff08c514f35?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NjV8MHwxfHNlYXJjaHwyfHx3b21hbiUyMGpvdXJuYWxpc3QlMjB3cml0ZXIlMjBwb3J0cmFpdHxlbnwwfHx8fDE3NzIwMTY4MjB8MA&ixlib=rb-4.1.0&q=85&w=400"
  },
  {
    email: "nina.wolf@serien.de",
    image: "https://images.unsplash.com/photo-1732550216149-41c470c95e53?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NDh8MHwxfHNlYXJjaHwyfHx5b3VuZyUyMGVkaXRvciUyMHdvbWFuJTIwaGVhZHNob3R8ZW58MHx8fHwxNzcyMDE2ODI3fDA&ixlib=rb-4.1.0&q=85&w=400"
  },
  {
    email: "mia.braun@serien.de",
    image: "https://images.unsplash.com/photo-1586297135537-94bc9ba060aa?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NDh8MHwxfHNlYXJjaHwxfHx5b3VuZyUyMGVkaXRvciUyMHdvbWFuJTIwaGVhZHNob3R8ZW58MHx8fHwxNzcyMDE2ODI3fDA&ixlib=rb-4.1.0&q=85&w=400"
  },
  {
    email: "lea.zimmermann@serien.de",
    image: "https://images.unsplash.com/photo-1582201942930-53fea460eeeb?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjY2NjV8MHwxfHNlYXJjaHwzfHx3b21hbiUyMGpvdXJuYWxpc3QlMjB3cml0ZXIlMjBwb3J0cmFpdHxlbnwwfHx8fDE3NzIwMTY4MjB8MA&ixlib=rb-4.1.0&q=85&w=400"
  },
  {
    email: "clara.hoffmann@serien.de",
    image: "https://images.pexels.com/photos/33871730/pexels-photo-33871730.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=400&w=400"
  },
  {
    email: "sarah.becker@serien.de",
    image: "https://images.pexels.com/photos/7667446/pexels-photo-7667446.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=400&w=400"
  }
];

async function addPhotos() {
  console.log('📸 Adding photos to authors...\n');
  
  for (const author of AUTHOR_PHOTOS) {
    try {
      await prisma.user.update({
        where: { email: author.email },
        data: { image: author.image }
      });
      console.log(`✅ ${author.email}`);
    } catch (error: any) {
      console.log(`❌ Failed: ${author.email} - ${error.message}`);
    }
  }

  console.log('\n✅ Photos added successfully!');
}

addPhotos()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
