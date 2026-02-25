/**
 * Add profile photos to authors
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const AUTHOR_PHOTOS = [
  {
    email: "sophie.hartmann@serien.de",
    image: "https://images.unsplash.com/photo-1616100123321-386befeb636c?crop=entropy&cs=srgb&fm=jpg&q=85&w=400"
  },
  {
    email: "julia.fischer@serien.de",
    image: "https://images.unsplash.com/photo-1762522921456-cdfe882d36c3?crop=entropy&cs=srgb&fm=jpg&q=85&w=400"
  },
  {
    email: "laura.klein@serien.de",
    image: "https://images.unsplash.com/photo-1616065297556-f05bc00c9a3e?crop=entropy&cs=srgb&fm=jpg&q=85&w=400"
  },
  {
    email: "marie.weber@serien.de",
    image: "https://images.pexels.com/photos/30468636/pexels-photo-30468636.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=400&w=400"
  },
  {
    email: "lena.bergmann@serien.de",
    image: "https://images.unsplash.com/photo-1618590067690-2db34a87750a?crop=entropy&cs=srgb&fm=jpg&q=85&w=400"
  },
  {
    email: "emma.mueller@serien.de",
    image: "https://images.unsplash.com/photo-1593231945511-9e141a85b017?crop=entropy&cs=srgb&fm=jpg&q=85&w=400"
  },
  {
    email: "anna.schneider@serien.de",
    image: "https://images.unsplash.com/photo-1641719149883-5a7e96f16829?crop=entropy&cs=srgb&fm=jpg&q=85&w=400"
  },
  {
    email: "nina.wolf@serien.de",
    image: "https://images.unsplash.com/photo-1594813451494-ba09d6e8a8d4?crop=entropy&cs=srgb&fm=jpg&q=85&w=400"
  },
  {
    email: "mia.braun@serien.de",
    image: "https://images.unsplash.com/photo-1655249481446-25d575f1c054?crop=entropy&cs=srgb&fm=jpg&q=85&w=400"
  },
  {
    email: "lea.zimmermann@serien.de",
    image: "https://images.unsplash.com/photo-1685217078385-27a4f31aad23?crop=entropy&cs=srgb&fm=jpg&q=85&w=400"
  },
  {
    email: "clara.hoffmann@serien.de",
    image: "https://images.unsplash.com/photo-1595982497214-77d6d50fe4f5?crop=entropy&cs=srgb&fm=jpg&q=85&w=400"
  },
  {
    email: "sarah.becker@serien.de",
    image: "https://images.pexels.com/photos/3448813/pexels-photo-3448813.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=400&w=400"
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
