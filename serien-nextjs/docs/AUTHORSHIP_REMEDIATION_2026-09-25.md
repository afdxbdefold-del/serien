# Autorenschaft und Altbestand: Sanierung

Stand: 25. September 2026. Arbeitsbranch: `codex/takeover`.

## Befund und Grenze

Die frühere Autorenübersicht machte aus Datenbankkonten ein angebliches
Redaktionsteam. Ein Skript generierte lange Lebensläufe aus Namen, kurzen
Beschreibungen und Artikeltiteln und verlangte dabei konkrete Ausbildungs- und
Berufsangaben ohne Belegprüfung. Ein anderes Skript ordnete Stock-Porträts zu.
Alte Importpfade wählten Personenkonten zufällig. Die tatsächliche Mitwirkung
dieser Personen an den Artikeln ist damit nicht nachgewiesen. Das ist kein Beleg
für eine bestimmte Maßnahme oder Bewertung durch Google.

Die aktuelle Hauptpipeline verwendet bereits ein festes Redaktionskonto für
automatische Entwürfe. Dessen technische Rolle beweist ebenfalls keine
menschliche Prüfung. Historische Konto- und Artikelzuordnungen werden für die
Nachvollziehbarkeit nicht stillschweigend überschrieben.

## Codeänderungen auf diesem Branch

- Beide Generatoren für Autorenlebensläufe, der zugehörige Polling-Worker,
  Skripte zum Erstellen und Wiederherstellen der fiktiven Personenkonten sowie
  Skripte zur Zuordnung und zum Download von Autorenporträts sind entfernt.
- Auch der KI-Generator für Schauspielerbiografien ist entfernt. Die
  Schauspielerseiten verwenden nicht mehr die möglicherweise generierten
  Datenbankbiografien, sondern nur den aktuellen, als TMDB gekennzeichneten
  Quelltext. Ohne Quelle entfällt der Biografieabschnitt. Personenseiten
  bleiben `noindex`; die veraltete Personen-Sitemap listet sie nicht mehr.
- Der Datenbank-Seed legt nur noch das technische Redaktionskonto an.
- Artikel zeigen serien.de als für die Veröffentlichung verantwortliche
  Organisation. Das gilt auch für strukturierte Daten und Open-Graph-Metadaten.
  Früher gespeicherte Personennamen, Porträts und Lebensläufe werden nicht mehr
  als bestätigte Urheberschaft ausgegeben.
- Die Autorenübersicht erklärt die Herkunft der alten Angaben. Bestehende
  `/autor/…`-URLs bleiben für die Nachvollziehbarkeit erreichbar, zeigen keine
  Lebensläufe oder Porträts mehr und sind auf `noindex` gesetzt.
- Die öffentlichen Autoren-APIs geben keine unbestätigten Namen oder
  Konto-E-Mail-Adressen mehr aus. Die alten Experten-Rankings nach
  automatisch zugewiesenen Artikeln sind entfernt.
- Drei alte Erzeugungspfade speichern neue Inhalte nur noch als Entwurf unter
  dem festen Redaktionskonto. Fehlende oder ungültige Konten brechen ab.
- Die redaktionellen Richtlinien beschreiben KI- und Software-Unterstützung
  sowie die Grenzen der früheren Qualitätssicherung offen.

## Vor einem Produktions-Rollout

1. Die Produktionsdatenbank und das PostgreSQL-Volume frisch sichern und beide
   Sicherungen isoliert wiederherstellen. Host-Speicher und laufende Dienste
   prüfen. Kein Prisma-Schema- oder Datenbankmigrationslauf ist nötig.
2. Branch und Zielcommit in Coolify prüfen, Deployment auslösen und Health,
   Container-Neustarts sowie Fehlerlogs kontrollieren.
3. Öffentlich eine alte News-URL, `/autoren`, zwei alte `/autor/…`-URLs, eine
   `/person/…`-URL und die Richtlinien prüfen. Sichtbare Namen,
   Schema-`author`, Open Graph, `noindex` und die zwei API-Antworten müssen
   übereinstimmen.

## Inhaltliche Sanierung

Die GSC-Auswahl vom 21. September enthält 50 triagierte Verlust-URLs. Zwei
Artikel wurden damals korrigiert und live geprüft; für „Running Point“ und
„Harry Hole“ liegen vorbereitete, noch nicht eingespielte Korrekturen vor.
Vor jeder Textänderung die aktuelle Quelle und den aktuellen Datensatz erneut
prüfen. Danach die übrigen Fälle nach nachgewiesenen Faktenfehlern,
Verwechslungen und Suchverlust abarbeiten. Keine pauschale Löschung, keine
künstliche Aktualisierung von Veröffentlichungsdaten. Wirkung anhand derselben
Search-Console-Seiten und Suchanfragen über mehrere Wochen bewerten.
