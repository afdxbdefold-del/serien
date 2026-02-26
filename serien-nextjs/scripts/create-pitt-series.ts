import prisma from '../lib/prisma';

async function createPittSeries() {
  // Create The Pitt series
  const series = await prisma.series.upsert({
    where: { tmdbId: 999999 }, // Placeholder TMDB ID
    update: {},
    create: {
      tmdbId: 999999,
      name: 'The Pitt',
      overview: 'Die Serie spielt im Pittsburgh Trauma Medical Center und folgt dem medizinischen Personal durch die Herausforderungen eines hektischen Krankenhausalltags.',
      firstAirDate: new Date('2025-01-01'),
      status: 'Returning Series',
      numberOfSeasons: 2,
      numberOfEpisodes: 12,
      genres: ['Drama', 'Medical'],
      networks: ['HBO Max'],
      voteAverage: 7.5,
      backdropPath: null,
      posterPath: null,
      cast: [],
      crew: [],
      trailers: []
    }
  });

  console.log('Series created:', series.name);
  console.log('TMDB ID:', series.tmdbId);
}

createPittSeries().finally(() => prisma.$disconnect());
