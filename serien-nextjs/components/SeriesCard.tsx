import Link from 'next/link';
import Image from 'next/image';

interface SeriesCardProps {
  tmdbId: number;
  slug: string;
  title: string;
  posterPath?: string;
  overview?: string;
}

export default function SeriesCard({
  tmdbId,
  slug,
  title,
  posterPath,
  overview
}: SeriesCardProps) {
  const posterUrl = posterPath || '/placeholder-poster.jpg';

  return (
    <Link href={`/serie/${tmdbId}-${slug}`} className="group block">
      <article className="relative aspect-[2/3] overflow-hidden rounded-lg bg-secondary cursor-pointer">
        {/* Poster Image */}
        <Image
          src={posterUrl}
          alt={title}
          fill
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />

        {/* Overlay on Hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
            <h3 className="font-bold text-lg mb-1">{title}</h3>
            {overview && (
              <p className="text-sm text-white/80 line-clamp-2">{overview}</p>
            )}
          </div>
        </div>

        {/* Follow Button */}
        <button 
          onClick={(e) => {
            e.preventDefault();
            // TODO: Implement follow logic
          }}
          className="absolute top-2 right-2 w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/30"
        >
          <span className="text-white text-xl">+</span>
        </button>
      </article>
    </Link>
  );
}