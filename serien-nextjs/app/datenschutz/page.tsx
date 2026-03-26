import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Datenschutzerklärung | serien.de',
  description: 'Datenschutzerklärung von serien.de - Informationen zum Umgang mit Ihren Daten.',
  robots: {
    index: false,
    follow: false,
  },
  alternates: {
    canonical: 'https://serien.de/datenschutz',
  },
};

export default function DatenschutzPage() {
  return (
    <main className="container mx-auto px-6 py-12 max-w-4xl">
      <article className="prose prose-gray dark:prose-invert max-w-none">
        <h1>Datenschutzerklärung</h1>
        
        <p className="lead">
          Der Schutz Ihrer persönlichen Daten ist uns ein besonderes Anliegen. Wir verarbeiten Ihre Daten 
          daher ausschließlich auf Grundlage der gesetzlichen Bestimmungen (DSGVO, TKG 2003).
        </p>

        <h2>1. Verantwortlicher</h2>
        <p>
          Verantwortlich für die Datenverarbeitung auf dieser Website ist:<br />
          <strong>serien.de</strong><br />
          E-Mail: mail@serien.de
        </p>

        <h2>2. Erhebung und Speicherung personenbezogener Daten</h2>
        
        <h3>2.1 Beim Besuch der Website</h3>
        <p>
          Beim Aufrufen unserer Website werden durch den auf Ihrem Endgerät zum Einsatz kommenden Browser 
          automatisch Informationen an den Server unserer Website gesendet. Diese Informationen werden 
          temporär in einem sog. Logfile gespeichert. Folgende Informationen werden dabei ohne Ihr Zutun 
          erfasst und bis zur automatisierten Löschung gespeichert:
        </p>
        <ul>
          <li>IP-Adresse des anfragenden Rechners</li>
          <li>Datum und Uhrzeit des Zugriffs</li>
          <li>Name und URL der abgerufenen Datei</li>
          <li>Website, von der aus der Zugriff erfolgt (Referrer-URL)</li>
          <li>Verwendeter Browser und ggf. das Betriebssystem Ihres Rechners</li>
        </ul>

        <h3>2.2 Lokale Speicherung (LocalStorage)</h3>
        <p>
          Wir verwenden LocalStorage, um Ihre Präferenzen (z.B. Theme-Einstellung, favorisierte Serien) 
          lokal in Ihrem Browser zu speichern. Diese Daten werden <strong>nicht</strong> an unsere Server 
          übertragen und verbleiben ausschließlich auf Ihrem Gerät.
        </p>

        <h2>3. Cookies</h2>
        <p>
          Diese Website verwendet keine Tracking-Cookies. Wir setzen lediglich technisch notwendige 
          Cookies ein, die für den Betrieb der Website erforderlich sind.
        </p>

        <h2>4. Externe Dienste</h2>
        
        <h3>4.1 TMDB (The Movie Database)</h3>
        <p>
          Wir nutzen die API von TMDB (The Movie Database) für Serien-Informationen, Bilder und Metadaten. 
          Bei der Nutzung dieser Dienste können Daten an TMDB übermittelt werden. 
          Die Datenschutzerklärung von TMDB finden Sie unter:{' '}
          <a href="https://www.themoviedb.org/privacy-policy" target="_blank" rel="noopener noreferrer">
            https://www.themoviedb.org/privacy-policy
          </a>
        </p>

        <h3>4.2 Vercel (Hosting)</h3>
        <p>
          Diese Website wird bei Vercel gehostet. Bei der Nutzung der Website werden Daten an Vercel 
          übermittelt. Die Datenschutzerklärung von Vercel finden Sie unter:{' '}
          <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer">
            https://vercel.com/legal/privacy-policy
          </a>
        </p>

        <h2>5. Ihre Rechte</h2>
        <p>Sie haben gegenüber uns folgende Rechte hinsichtlich der Sie betreffenden personenbezogenen Daten:</p>
        <ul>
          <li>Recht auf Auskunft (Art. 15 DSGVO)</li>
          <li>Recht auf Berichtigung (Art. 16 DSGVO)</li>
          <li>Recht auf Löschung (Art. 17 DSGVO)</li>
          <li>Recht auf Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
          <li>Recht auf Datenübertragbarkeit (Art. 20 DSGVO)</li>
          <li>Recht auf Widerspruch (Art. 21 DSGVO)</li>
        </ul>

        <h2>6. Beschwerderecht</h2>
        <p>
          Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde über die Verarbeitung Ihrer 
          personenbezogenen Daten durch uns zu beschweren.
        </p>

        <h2>7. Änderungen dieser Datenschutzerklärung</h2>
        <p>
          Wir behalten uns vor, diese Datenschutzerklärung anzupassen, damit sie stets den aktuellen 
          rechtlichen Anforderungen entspricht oder um Änderungen unserer Leistungen in der 
          Datenschutzerklärung umzusetzen.
        </p>

        <p className="text-sm text-gray-500 dark:text-gray-400 mt-8">
          Stand: März 2025
        </p>
      </article>
    </main>
  );
}
