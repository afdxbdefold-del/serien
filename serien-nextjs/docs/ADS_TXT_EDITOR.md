# ads.txt-Editor

`/ads-txt-editor` ist ein eigenständiger, nicht indexierbarer Verwaltungsbereich.
Er ergänzt den fest im Repository versionierten ads.txt-Grundbestand um
PostgreSQL-gespeicherte Zeilen. Der Grundbestand kann im Editor nicht gelöscht
werden. Nach einem Deployment bleiben Ergänzungen und die letzten 30 Versionen
erhalten. Ein Rollback erzeugt seinerseits eine neue Version.

## Einrichtung

1. In einem lokalen interaktiven Terminal im Projektverzeichnis
   `npm run ads-editor:hash-password` ausführen. Das Passwort wird nicht
   angezeigt oder in einer Shell-Befehlszeile übergeben. Der ausgegebene
   bcrypt-Hash ist nur für die geschützte Coolify-Umgebungsvariable
   `ADS_EDITOR_PASSWORD_HASH` bestimmt; nie in Git oder Chat kopieren.
2. In Coolify ausschließlich diese Variable setzen. `JWT_SECRET` muss bereits
   vorhanden und mindestens 32 Zeichen lang sein. Ohne beides verweigert
   die Anmeldung den Betrieb.
3. Vor dem Rollout Datenbank- und Volume-Backup samt Restore-Test prüfen.
   Danach nur `codex/takeover` deployen und `/ads.txt` sowie den Editor
   unabhängig von außen prüfen. Niemals Produktionsmigrationen ausführen.

## Bedienung

- Mehrere vollständige ads.txt-Zeilen in das Feld einfügen und veröffentlichen.
  Akzeptiert werden Seller-Zeilen mit `DIRECT`/`RESELLER` und die drei
  Domain-Direktiven. Fehlerhafte Zeilen stoppen die gesamte Eingabe.
- Die öffentliche ads.txt kann bis zu 60 Sekunden zwischengespeichert sein.
  Duplikate des Grundbestands werden bei der Auslieferung unterdrückt.
- Eine frühere Version oder den Ursprungszustand unter „Rollback“ wählen.
  Die aktuelle Version wird nicht überschrieben, sondern als neuer Eintrag
  in der Historie festgehalten.
- Wenn die Datenbank ausfällt, liefert `/ads.txt` den Git-Grundbestand. Der
  Editor verweigert Änderungen bis die Datenbank wieder erreichbar ist.

## Sicherheit und Grenzen

Die Anmeldung verwendet einen bcrypt-Hash, eine vierstündige, HttpOnly- und
SameSite-Strict-Sitzung, Same-Origin-Prüfung und ein Limit von fünf
Anmeldeversuchen je IP und 15 Minuten pro laufender Instanz. Für ein öffentlich
erreichbares Schreibwerkzeug sollte zusätzlich ein starkes, einzigartiges
Passwort und möglichst eine IP-/Access-Regel vor dem Editor eingesetzt werden.
Das in einem Chat bereits genannte Passwort sollte nicht unverändert live
verwendet werden. Eine Rotation des Hashes beendet bestehende Sitzungen nicht
sofort; dafür muss auch der Signaturschlüssel rotiert werden oder maximal vier
Stunden gewartet werden.
