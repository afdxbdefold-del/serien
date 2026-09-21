# Warum der Build früher erfolgreich erschien

Stand: 21. September 2026. Zeiten in UTC. Untersuchung über die bestehende
Coolify-Browsersitzung, Kerneljournal, sysstat und Git-Vergleich; keine Secrets
oder vollständigen Deploymentprotokolle in diesen Bericht übernommen.

## Ergebnis

Das letzte erfolgreiche Deployment ist **kein Beleg für einen zuvor gesunden
Buildbetrieb**. Während dieses Deployments kam es bereits zu einem globalen
Speichermangel mit vom Kernel beendeten Prozessen. Der spätere grüne
Deploymentstatus verdeckt diese vorherige Überlastung.

Belegt ist eine unzureichend geschützte Konkurrenz um den gemeinsamen
Serverspeicher beim Build. Ein Astra-spezifischer Compilerfehler, ein
Speicherleck oder die zwingende Notwendigkeit eines größeren Servers sind
damit **nicht** nachgewiesen.

## Drei unterschiedliche Abläufe

| Versuch | Beobachtung | Ergebnis |
| --- | --- | --- |
| 20.09., `2d75e262`, Deployment `1zptz0yeujeaycagmoyawd54` | Start 12:42:35; Paketinstallation 43,9 s; Kompilierung 9,7 min; gesamter Next-Build-Schritt 665,6 s. Kernel meldet währenddessen globalen OOM. | Coolify meldet nach 18m49s dennoch Success. |
| 21.09., `fbd68a98`, Deployment `kiwph5gfjlxcbt7hvrjmhwyh` | Start 09:34:58; Paketinstallation 50,4 s; Kompilierung begonnen, kein protokollierter Compilerfehler. Starker gemessener Speicher-/I/O-Druck und Website-Timeouts. | Build-Helfer gezielt gestoppt; Failed nach 9m12s, bevor die frühere Kompilierungsdauer erreicht war. Kein bewiesener OOM-Kill in diesem Versuch. |
| 21.09., `9da04551`, Deployment `hurgzylfhd82v2ciodmxe07e` | Start 13:34:57; Installation läuft nachweislich im begrenzten Builder. Wächter stoppt 13:36:03 bei 343932 KiB verfügbarem Host-RAM, unter der Grenze von 393216 KiB. | Failed nach 1m17s, noch während `npm ci`. Kein belegtes Builder-OOM und kein Test des eigentlichen Next-Builds. |

Der letzte Versuch scheiterte somit an der bewusst eingeführten
Sicherheitsbedingung, nicht an einer nachgewiesenen Fehlfunktion des
Anwendungscodes. Die Begrenzungsprobe davor erzeugte absichtlich einen
**separaten** cgroup-OOM; diesen nicht dem echten Deployment zuordnen.

## Historischer Nachweis vom 20. September

Das Kerneljournal meldet um 12:53:16 `CONSTRAINT_NONE` / `global_oom` und
`Out of memory: Killed process 1693312 (next-server ...)`. Die gemeldete
anonyme residente Belegung des Opfers beträgt **312412 kB**, nicht 1,3 GB.
Auch ein systemd-Prozess wurde in diesem Zeitfenster beendet.

Die frühere Container-ID des Next-Prozesses ist
`3e6bb036c5d52d01dbc21ea98723504d232e79c94c1104d10d57240bb86fdf`.
Sie ist nicht mehr in `docker ps -a` vorhanden. Der Prozessname entspricht
dem Next-Server; die eindeutige Zuordnung dieses entfernten Containers zu
einem bestimmten damaligen Dienst wurde nicht wiederhergestellt.

Die erhaltene sysstat-Datei `/var/log/sysstat/sa20` zeigt:

| Uhrzeit | Verfügbarer RAM (KiB) | Last, 1 Minute | Blockierte Prozesse |
| --- | ---: | ---: | ---: |
| 12:40:16 | 1409048 | 0,53 | 0 |
| 12:53:16 | 333920 | 106,79 | 32 |
| 13:00:01 | 84764 | 29,46 | 1 |

Der Server hat zwei CPU-Kerne. Die Last enthält auch auf I/O wartende
Prozesse; sie ist keine CPU-Prozentangabe. Einzelne sysstat-Proben sind keine
lückenlose Aufzeichnung des Spitzenverbrauchs.

Die Prozessliste im OOM-Zeitfenster enthält unter anderem einen Node-Prozess
mit rund 796 MiB RSS und den Docker-Daemon mit rund 756 MiB RSS. Diese Werte
belegen große gleichzeitige Verbraucher, aber weder ein Speicherleck noch
die genaue Rolle jedes Node-Prozesses. RSS mehrerer Prozesse ist wegen
gemeinsam genutzter Seiten nicht einfach als Gesamtspeicher zu addieren.

## Ausgeschlossene bzw. nicht bestätigte Erklärungen

- Erfolgreicher und erster fehlgeschlagener Build verwendeten denselben
  Coolify-Helper `1.0.16`, Next.js `15.5.25` und denselben Node-Basisdigest
  `sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293`.
- Zwischen Live-Commit und erstem Fehler änderten sich weder Dockerfile,
  Lockfile, Dependency-Versionen, Prisma-Schema noch eigentlicher Buildbefehl.
  Neue Tests/Astra-Evaluationen werden von `npm run build` nicht ausgeführt.
- Neue Testscripts verändern zwar `package.json` und invalidieren den
  Installations-Layer. **Auch der erfolgreiche Vergleichsbuild installierte
  jedoch neu.** Cacheverlust allein erklärt den Unterschied nicht.
- Der versionierte App-Inhalt wuchs um 315656 Bytes, etwa ein Prozent. Keine
  neuen großen Binärdateien, Buildartefakte oder zusätzlichen App-Routen.
- Die nachträglich gesetzte einzelne Next-CPU erklärt den ursprünglichen
  Fehler nicht. Bei zwei erkannten CPUs verwendet diese Next-Version bereits
  standardmäßig einen Seitenworker. Die weiteren Speicheroptimierungen sind
  nicht mit einem nachgewiesenen vollständigen Produktionsbuild gleichzusetzen.
- Coolifys Sentinel-Messhistorie ist nicht aktiviert. Die vorhandene
  Betriebssystem-Messhistorie wurde gelesen; Monitoring wurde nicht verändert.

## Zustand nach Untersuchung

- Der begrenzte Builder ist gestoppt, Cache und Konfiguration bleiben erhalten.
- Bisherige App `2d75e262` und PostgreSQL laufen weiter, keine durch uns
  ausgelösten Neustarts. Datenbankstand weiterhin 4360 Artikel; News-Pause aktiv.
- Öffentlicher Healthcheck erfolgreich; Startseite zusätzlich im normalen
  Chrome-Browser mit Karussell und News-Inhalten bestätigt.
- Ein Standard-curl auf `/` erhält aufgrund des unveränderten Botfilters
  absichtlich HTTP 204. Das ist kein geeigneter HTML-Verfügbarkeitstest.
- Auto-Deploy bleibt manuell; News-, YouTube- und Video-Schedules bleiben
  für die ausstehende Abnahme deaktiviert. Kein weiterer Build gestartet.
- Kein Serverwechsel, keine Größenänderung, kein Swap, kein Neustart des
  Docker-Daemons, keine Migration und keine Änderung an DNS oder Zugängen.

## Nächster technischer Schritt

Den Build auf dem bestehenden Server gezielt optimieren und die Phasen
Installation, Kompilierung und Image-Import getrennt messen. Dabei müssen
auch Docker-Daemon und laufende Dienste berücksichtigt werden: Sie liegen
nicht vollständig innerhalb des neuen Builderlimits. Keine pauschale
Limiterhöhung und kein weiterer ungeschützter Wiederholungsversuch.

Ein etwaiger späterer Test braucht eine begründete neue Speicherstrategie
und dieselben Backup-/Abbruchgrenzen. Allein das erneute Durchlaufenlassen
bis zum Kernel-OOM ist keine akzeptable Wiederherstellung des früheren
Verhaltens. Diagnose abgeschlossen; eine sichere erfolgreiche neue
Deploymentstrategie und die redaktionelle Ende-zu-Ende-Abnahme bleiben offen.
