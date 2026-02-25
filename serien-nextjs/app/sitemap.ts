import { MetadataRoute } from 'next';
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: 'https://serien.de', lastModified: new Date() }];
}
