# News-Pipeline: Kosten- und Betriebsbefund vom 19. Oktober 2026

## Live-Befund (nur lesend geprüft)

- OpenAI Usage, Projektfilter `serien.de`, 1.–19. Oktober: 52,23 USD, 914
  Modellaufrufe, 2.322.124 Input- und 508.142 Output-Tokens; 182.459 Input-
  Tokens wurden aus dem Cache bedient. Die Kostenansicht ist eine
  Projektübersicht, keine Zuordnung zu einzelnen Artikeln. Das gewünschte
  Monatsziel von 30 EUR ist bereits überschritten; Umrechnung und Steuern
  ändern nichts an der Größenordnung.
- Letzte sieben Tage: 25,01 USD, 454 Aufrufe, 1.085.614 Input- und 245.875
  Output-Tokens, 69.054 gecachte Input-Tokens. Fast alle Input-Tokens liefen
  über Astra. Es gibt bislang keine interne Kostenmessung pro News-Versuch.
- Coolify: Anwendung und PostgreSQL laufen im Projekt `My first project / production`.
  Der konfigurierte Git-Branch der Anwendung ist `codex/takeover`, der Build
  verwendet `/serien-nextjs/Dockerfile`. Der News-Task läuft stündlich
  (`0 * * * *`), seine zuletzt angezeigten Ausführungen sind fehlgeschlagen.
  Der 19.-Oktober-Lauf erreichte einen Kandidaten und meldete 0 Publikationen,
  1 Fehler und 57 zurückgestellte Kandidaten. Das Laufzeitlog nennt in
  Schritt `2_classification` HTTP 429 `credit_balance_exhausted`. Das ist
  ein Anbieter-/Abrechnungsproblem des verwendeten Projektzugangs, nicht
  allein ein Qualitäts-Gate. Der sichtbare Organisations-/Projektverbrauch
  beweist nicht, dass für genau diesen Schlüssel noch nutzbares Guthaben
  vorhanden ist.
- Coolify zeigt für PostgreSQL derzeit 0 Backuppläne und 0 Backupausführungen.
  Ein aktueller, wiederherstellbarer Datenbank-/Volume-Stand ist nicht
  nachgewiesen. Keine Produktionänderung oder Redeployment auf dieser Basis.

## Prozess und Kostentreiber im Code

1. Der stündliche Task fragt sechs Quellen ab und wählt standardmäßig bis zu
   fünf neue Kandidaten pro Lauf. Das alte Tageslimit von zehn zählte nur
   veröffentlichte Artikel und begrenzte fehlgeschlagene oder abgelehnte
   Versuche nicht.
2. Ein Kandidat kann Klassifizierung, semantischen Duplikatcheck,
   Faktenextraktion, Textgenerierung und bis zu drei redaktionelle Modellaufrufe
   auslösen. Bislang liefen alle Rollen über Astra. Der Duplikatcheck stand vor
   dem sicheren Deutschland-Vorcheck; ein später Ausschluss konnte bereits
   Modellkosten verursacht haben.
3. Ein bestätigter fehlender Deutschlandbeleg durfte nach sechs Stunden
   erneut geprüft werden. Das konnte dieselbe nicht passende Quelle mehrfach
   kostenpflichtig klassifizieren. Fehler in späten Schritten konnten ganze
   Generierungspakete wiederholen.
4. Ein `429 credit_balance_exhausted` stoppt zwar den aktuellen Import nach
   einem Kandidaten, der stündliche Task probiert es weiterhin erneut.

## Änderungen auf `codex/takeover`

- Sol/low für die frühen, strukturierten Entscheidungen; Astra/low bleibt für
  Fakten, Text und Schlussredaktion. Kein automatischer Provider-Fallback,
  keine Abschwächung der Deutschland-, Quellen- oder Faktenprüfung.
- Deutschland-Vorcheck vor semantischer Duplikatprüfung; bestätigte
  Nicht-DE-Kandidaten frühestens nach 24 Stunden neu prüfen.
- Maximal drei automatische Kandidatenversuche pro UTC-Tag. Diese Grenze
  zählt auch abgelehnte/fehlgeschlagene Versuche und reduziert den theoretisch
  unbeschränkten Kostentreiber unabhängig von Artikelpublikationen.
- Jede erfolgreich beantwortete automatische News-Modellanfrage speichert
  ausschließlich Rolle, Modell, Tokenzahlen und USD-Schätzkosten als eigene
  `pipeline_runs`-Zeile. Keine Prompts, URLs oder Secrets. Unvollständige
  Nutzungsdaten oder fehlgeschlagene Verbuchung stoppen die Strecke.
- Standardmäßig 25 USD geschätzter Monatswert mit 4 USD Reserve je neuem
  Kandidaten. Im Einführungsmonat Oktober 2026 ist ein Projektverbrauch-
  Übertrag erforderlich; ohne ihn startet kein automatischer Kandidat. Ab
  November verfällt der Übertrag. Die Grenze ist nur eine interne Schätzung,
  keine harte OpenAI-Abrechnungsgrenze und kein Wechselkursversprechen.
- Neue Nutzungszeilen werden aus normalen Pipeline-/Gesundheitsstatistiken
  herausgefiltert. Es wurden keine Datenbankschemata oder Secrets geändert.

## Verifikation und Reihenfolge

Die Offline-Pipeline- und Transporttests bestehen. Sie belegen weder Sols
redaktionelle Eignung mit echten deutschen Nachrichten noch einen erfolgreichen
Live-Lauf. Die vollständige TypeScript-Prüfung meldet weiterhin zahlreiche
Fehler außerhalb der bearbeiteten Dateien; in den bearbeiteten Dateien wurde
kein neuer Typfehler gemeldet.

1. Abrechnungs-/Projektzuordnung des aktuellen OpenAI-Schlüssels prüfen,
   ohne Schlüsselwerte in Logs oder Chat offenzulegen. Kein kostenpflichtiger
   Probelauf, solange `credit_balance_exhausted` anhält.
2. Datenbank- und Volume-Backup erstellen und einen getrennten Restore
   verifizieren. Erst danach Produktionsänderungen.
3. Nach geklärter Abrechnung eine kleine, budgetierte Sol/Astra-Evaluation mit
   Deutschland-, UK-lokal-, Duplikat- und Quellenkonflikt-Fällen durchführen;
   bei Qualitätsverlust die Sol-Route nicht automatisch freigeben.
4. Aktuellen Monatsverbrauch als Baseline berücksichtigen. Da 52,23 USD im
   Oktober bereits über dem Ziel liegen, keine weitere automatische
   Modellarbeit im Oktober freigeben. Coolify-Deploy-Trigger vor einem Push
   prüfen; nur `codex/takeover`, niemals `main`.
5. Nach einem sicheren Rollout öffentliche Artikelanzeige, Bild, Quellenlink,
   Coolify-Läufe, Modellverbrauch und tatsächliche Kosten pro publizierter
   Nachricht mindestens über mehrere Läufe verifizieren. Erst dann das
   Tageslimit anhand nachgewiesener Qualität und Ertrag anpassen.
