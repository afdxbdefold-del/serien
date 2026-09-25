# Personenlinks: Absicherung vom 25. September 2026

Status: lokal auf `codex/takeover` implementiert und getestet; nicht gepusht
oder deployt. Bestehende Artikel und Entwürfe in Produktion wurden nicht geändert.

## Anlass und Fehlerklasse

Die Live-Statusprüfung fand im zurückgehaltenen Entwurf zu „It Gets Worse“
den Ortsnamen London als Personenlink. Die alte Cast-Verlinkung erlaubte sowohl
globale einteilige Personennamen als auch Nachnamen-Fallbacks für den Seriencast.
Ein Katalogtreffer bzw. eine Cast-Zuordnung beweist jedoch nicht, dass ein
gleichlautender Ort im Artikel eine Person bezeichnet.

## Änderung

- Nur vollständige mehrteilige Namen in exakter Schreibweise werden automatisch
  verlinkt. Mehrdeutige Namen mit verschiedenen Zielen bleiben unverlinkt.
- Keine Nachnamen-/Mononym-Fallbacks. Auch echte einteilige Künstlernamen bleiben
  vorsorglich ohne automatischen Personenlink; der sichtbare Text bleibt erhalten.
- Markdown-Verlinkung bearbeitet ausschließlich eindeutig zuordenbare Textstellen
  in Absätzen, nicht Überschriften, vorhandene Links, Bilder, Code oder HTML.
  Bei unsicherer Positionszuordnung werden optionale Links ausgelassen.
- Der HTML-Autolinker arbeitet mit DOM-Textknoten und schützt bestehende Links.
- Die Hauptpipeline entfernt unbestätigte Personenlinks vor der Quellenprüfung,
  ohne den sichtbaren Text zu entfernen oder ein anderes Linkziel zu erfinden.
- Nach einer möglichen Modellüberarbeitung prüft ein verpflichtendes Gate erneut
  Linktext und Katalogziel. Ein Fehler hält den Artikel als Entwurf zurück; der
  bereits geprüfte Text wird nicht nachträglich stillschweigend verändert.
- Gleichwertige absolute, protokollrelative und URL-codierte Personenpfade werden
  ebenfalls geprüft. Unerwartete Ports und Zugangsdaten im Link werden abgewiesen.

## Lokale Prüfung

`npm run test:pipeline` umfasst jetzt `tests/person-link-safety.test.ts`.
Die Pipeline-Tests bestanden mit simulierten Modellen und ohne Produktionszugriff.
Die ergänzten URL-Alias-Tests bestanden anschließend ebenfalls.
Ein unabhängiger TypeScript-Vergleich gegen HEAD ergab unverändert 148 bestehende
Diagnosen, keine zusätzlichen und keine in den geänderten/neuen Dateien.
Der globale Typecheck ist damit weiterhin nicht vollständig grün; diese Änderung
führt keine neuen Typfehler ein. Die unabhängige Codeprüfung fand keinen offenen
Blocker im Personenlink-Schutz; `git diff --check` bestand.

Regressionen umfassen London/Washington als Orte, vollständige Darstellernamen,
Namensdopplungen, Unicode-Grenzen, HTML-/Markdown-Schutz, Wiederholungssicherheit,
Text-/Format-Erhalt beim Entfernen falscher Links und die Sperre nach einer
fehlerhaften Textrevision. Der echte Pipeline-Einstieg wird dabei nur als Syntaxbaum
gelesen, niemals mit seinen Datenbank- oder Modellzugriffen ausgeführt.

## Abgrenzung und Freigabe

Dies sichert die konkrete Klasse falscher **Personenlinks** ab. Es ist keine
Garantie für die Semantik sämtlicher interner Links: Figuren- und Streamerlinks
sowie manuell aufrufbare ältere Wartungsskripte benötigen eine separate Prüfung.
Die redaktionelle Quellenprüfung bleibt erhalten.

Vor einem freigegebenen Rollout: Datenbank- und Volume-Sicherungen verifizieren,
ausschließlich `codex/takeover` deployen und danach den nächsten regulären Lauf
samt gespeicherten Links und tatsächlicher öffentlicher Anzeige kontrollieren.
Keine zusätzliche Veröffentlichung oder Produktionsbereinigung ist Teil dieser
lokalen Korrektur.
