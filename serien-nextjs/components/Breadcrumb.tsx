import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export default function Breadcrumb({ items, className = '' }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" data-testid="breadcrumb" className={`text-sm text-gray-500 dark:text-gray-400 ${className}`}>
      <ol className="flex items-center gap-1 overflow-x-auto whitespace-nowrap scrollbar-hide pb-1">
        <li className="flex-shrink-0">
          <Link href="/" className="hover:text-gray-900 dark:hover:text-white transition-colors">
            <Home className="w-3.5 h-3.5" />
          </Link>
        </li>
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1 flex-shrink-0">
            <ChevronRight className="w-3 h-3 text-gray-400 flex-shrink-0" />
            {item.href && i < items.length - 1 ? (
              <Link href={item.href} className="hover:text-gray-900 dark:hover:text-white transition-colors">
                {item.label}
              </Link>
            ) : (
              <span className="text-gray-700 dark:text-gray-300">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
