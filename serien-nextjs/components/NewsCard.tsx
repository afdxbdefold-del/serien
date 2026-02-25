import Link from 'next/link';
import Image from 'next/image';

interface NewsCardProps {
  slug: string;
  title: string;
  excerpt?: string;
  heroLocalUrl?: string;
  publishedAt: Date;
  category?: string;
  authorName?: string;
}

export default function NewsCard({
  slug,
  title,
  excerpt,
  heroLocalUrl,
  publishedAt,
  category,
  authorName
}: NewsCardProps) {
  return (
    <Link href={`/${slug}`} className="group block">
      <article className="flex gap-4 md:gap-6 pb-6 border-b border-border hover:bg-muted/50 transition-colors rounded-lg p-4">
        {/* Image */}
        {heroLocalUrl && (
          <div className="w-32 md:w-48 flex-shrink-0">
            <div className="aspect-video relative overflow-hidden rounded-lg">
              <Image
                src={heroLocalUrl}
                alt={title}
                fill
                className="object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Meta */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            {category && (
              <span className="uppercase font-medium">{category}</span>
            )}
            <span>•</span>
            <time dateTime={publishedAt.toISOString()}>
              {new Date(publishedAt).toLocaleDateString('de-DE', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
              })}
            </time>
          </div>

          {/* Title */}
          <h3 className="text-lg md:text-xl font-bold mb-2 group-hover:text-primary transition-colors line-clamp-2">
            {title}
          </h3>

          {/* Excerpt */}
          {excerpt && (
            <p className="text-sm text-muted-foreground line-clamp-2 hidden md:block">
              {excerpt}
            </p>
          )}
        </div>
      </article>
    </Link>
  );
}