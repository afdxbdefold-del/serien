/**
 * Author Box Component
 * Displays author byline with short bio and link to full profile
 */

import Image from 'next/image';
import Link from 'next/link';

interface AuthorBoxProps {
  author: {
    id: string;
    name: string | null;
    image: string | null;
    bio: string | null;
    expertise: string[];
  };
}

// Generate author slug from name
function getAuthorSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Truncate bio to ~150 characters at word boundary
function truncateBio(bio: string, maxLength: number = 150): string {
  if (bio.length <= maxLength) return bio;
  
  const truncated = bio.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  return truncated.substring(0, lastSpace) + '…';
}

export default function AuthorBox({ author }: AuthorBoxProps) {
  if (!author.name) return null;
  
  const authorSlug = getAuthorSlug(author.name);
  const shortBio = author.bio ? truncateBio(author.bio) : null;
  
  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 p-6 my-8">
      <div className="flex items-start gap-4">
        {/* Author Avatar */}
        <Link href={`/autor/${authorSlug}`} className="flex-shrink-0">
          {author.image ? (
            <Image
              src={author.image}
              alt={author.name}
              width={64}
              height={64}
              className="rounded-full object-cover"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-xl font-bold">
              {author.name.charAt(0).toUpperCase()}
            </div>
          )}
        </Link>
        
        {/* Author Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">
              Autor
            </span>
          </div>
          
          <Link 
            href={`/autor/${authorSlug}`}
            className="text-lg font-semibold text-gray-900 dark:text-white hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
          >
            {author.name}
          </Link>
          
          {/* Expertise Tags */}
          {author.expertise && author.expertise.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {author.expertise.slice(0, 3).map((tag, idx) => (
                <span 
                  key={idx}
                  className="text-xs px-2 py-0.5 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          
          {/* Short Bio */}
          {shortBio && (
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-3 leading-relaxed">
              {shortBio}
            </p>
          )}
          
          {/* Link to Full Profile */}
          <Link 
            href={`/autor/${authorSlug}`}
            className="inline-flex items-center gap-1 text-sm text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 font-medium mt-3 transition-colors"
          >
            Alle Artikel von {author.name.split(' ')[0]}
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
