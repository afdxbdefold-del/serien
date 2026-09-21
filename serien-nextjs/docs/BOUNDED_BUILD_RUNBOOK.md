# Begrenzte Builds auf dem Produktionsserver

Stand: 21. September 2026, nach 15:13 UTC. Auch der abschließende geschützte
Cursor-Rollout ist bestätigt live; nur der News-Scheduler ist freigegeben.
Ein früherer Versuch wurde vom Sicherheitswächter abgebrochen; dieser
historische Fehlschlag ist nicht der aktuelle Zustand.
Siehe [Ursachenanalyse](BUILD_INCIDENT_2026-09-21.md).

## Aktueller Nachtrag: Cursor-Rollout erfolgreich live

Bestätigt live: `17b62e4546582e751fd3db52b749d033f1185724` auf
`codex/takeover`, einschließlich des 8-MiB-Quellenabruf-Fixes und der
persistenten Quellenrotation. Coolify-Deployment `aq2vx26tqzt8nlyitv0lpcc1`
war um etwa 15:11 UTC erfolgreich: Kompilierung 114 Sekunden, alle 164
statischen Seiten, Export 27,9 Sekunden und anschließender Containerwechsel.
Neuer App-Container `i8e996hq5t8moyf9fw8p0pbs-150527161770` gesund,
Neustartzähler 0, `OOMKilled=false`. Wächter ohne Abbruch, Origin/Public
HTTP 200. Alle sieben öffentlichen Artikel-/Bild-/Listenprüfungen nach diesem
Deployment erneut bestanden; News-Scheduler anschließend gezielt freigegeben.
Die Limits bleiben unverändert: 1024 MiB RAM, zusätzlich höchstens
2048 MiB Swap, 0,75 CPU, `max-parallelism=1`.

Für diesen Lauf wurde ein neuer Sicherheitswächter gestartet: PID 27375,
privates Protokoll `/data/coolify/serien-build.uNkYnX/guard-cursor.log`.
Builder und Wächter wurden um 15:12 UTC gezielt gestoppt; Swap bleibt aktiv.
PID und Status sind ein zeitgebundener Snapshot, keine dauerhafte
Dienstkonfiguration; vor einer Aktion aktuelle Prozessidentität prüfen.
Die Plattenuntergrenze beträgt jetzt **4 GiB** (zuvor 6 GiB). Vor Start
waren rund 6,7 GiB frei; der vorherige Build erhöhte die Belegung um rund
1,6 GiB. Diese Beobachtung garantiert nicht den Platzbedarf eines nächsten
Builds. **Keine Daten, Volumes oder Images zur Platzbeschaffung gelöscht.**
Die übrigen Speicher-/Swap-/Gesundheits-Abbruchregeln bleiben bestehen.

4 GiB Host-Swap sind aktiv, weiterhin ohne fstab-Eintrag. Auto-Deploy bleibt
**„Manual deployments only“**. Nach erfolgreichem Test des vorhandenen
Coolify-News-Tasks um 15:13:00 UTC wurde dieser um 15:13:42 UTC aktiviert:
stündlich `0 * * * *`, Task-Limit 3600 Sekunden, HTTP-Deadline 3500 Sekunden;
gespeicherten Zustand erneut geprüft. Globale Pipeline-Pause ist `false`,
YouTube- und Video-Tasks bleiben deaktiviert. Der erste echte Pipeline-Artikel ist öffentlich
einschließlich Hero, Karussell und News-Liste geprüft (siehe `TAKEOVER_STATUS.md`),
nach dem finalen Rollout erneut bestätigt. Kein zusätzlicher Scheduler.

Nach Veröffentlichung wurde zusätzlich `post-publication-1512.dump` mit
4.361 Artikeln erstellt. Inhaltsverzeichnis und SHA-256 geprüft; noch kein
separater Restore dieses Dumps. Die zuvor erfolgreichen logischen und
physischen Restore-Tests bleiben Nachweise für den älteren 4.360er-Satz.

PostgreSQL ist gesund, Neustartzähler 0, Postmaster-Start am 2. August;
Docker zeigt historisch `OOMKilled=true`. Keine neuen Kernel-OOM-Ereignisse
seit 14:00 UTC bei der aktuellen Prüfung. Die historische Markierung ist
nicht gleichbedeutend mit einem aktuellen Postmaster-Neustart und darf nicht
als `false` dokumentiert werden. Keine Migration und keine Änderung an `main`.

## Historischer Nachweis: erfolgreicher freigegebener Rollout um 14:28 UTC

Coolify-Deployment `bqwzdqac1fw9xfyw5ve38vr7` war um **14:28 UTC** erfolgreich:
Commit `cbd216ffb3868ca91a986a601984a46db0f71961` auf `codex/takeover`.
`npm ci` dauerte 78,3 Sekunden, die Kompilierung etwa zwei Minuten;
alle 164 statischen Seiten und der anschließende Image-Import wurden fertig.
Neuer App-Container `i8e996hq5t8moyf9fw8p0pbs-142026647632`: gesund,
Neustartzähler 0, `OOMKilled=false`. PostgreSQL blieb unverändert; keine
Schema-Migration, keine Änderung oder Deployment von `main`.

Die Startseite wurde mit fünf geladenen Karussellbildern geprüft, `/news`
antwortete mit HTTP 200/HTML und vier Sitemaps mit HTTP 200/XML.
**Builder und Sicherheitswächter wurden nach diesem früheren Rollout gestoppt.**
Für den späteren Lauf gilt der aktuelle Nachtrag oben. Auto-Deploy bleibt
manuell. Der erfolgreiche Build allein war keine Abnahme der News-Automatik;
der inzwischen bestandene echte Publish und die spätere Scheduler-Freigabe
sind in `TAKEOVER_STATUS.md` getrennt dokumentiert.

Nach der erneuten Live-Freigabe wurden am 21. September um 14:16 UTC beide
Backup-Prüfsummen und der logische/physische Restore-Nachweis erneut geprüft.
Anwendung und Datenbank waren gesund, jeweils ohne Neustart.
Beide Backup-Prüfsummen wurden nach dem Rollout um 14:30 UTC erneut bestätigt.
Die logische und physische Wiederherstellung waren isoliert erfolgreich;
eine frische Offsite-Kopie steht noch aus.

Auf dem ext4-Host wurde die vorher nicht vorhandene Datei
`/data/coolify/serien-build.swap` mit 4 GiB, Eigentümer root und Modus 0600
angelegt und als Swap aktiviert. Danach waren noch 12 GiB Datenträger frei.
Kein fstab-Eintrag, keine Änderung der globalen Swappiness: Nach einem
Host-Neustart ist dieser Puffer nicht automatisch aktiv. Auto-Deploy bleibt
deshalb manuell; vor jedem Build muss aktiver Swap geprüft werden.

Die unten dokumentierten ursprünglichen 640-MiB-Grenzen sind historisch.
Builder-Metadaten, Docker HostConfig und tatsächliche Kernel-Grenzen wurden
jetzt übereinstimmend auf **1024 MiB RAM plus maximal 2048 MiB Swap** sowie
0,75 CPU gesetzt: `memory.max=1073741824`,
`memory.swap.max=2147483648`, `cpu.max=75000 100000`.
Der Dockerfile begrenzt nur im Build-Stage den V8-Old-Space auf 1024 MiB;
dieser Wert gilt pro Prozess, nicht für den gesamten Build. Das unabhängige
Runtime-Stage erhält diese Variable nicht.

Swap nicht automatisch deaktivieren oder löschen: Das Rückholen ausgelagerter
Produktionsseiten könnte erneut Speichermangel verursachen. Keine Secrets oder
Heapdumps protokollieren.

## Zweck und Grenzen

serien.de, PostgreSQL und Coolify teilen einen Hetzner-Server mit 3819 MiB RAM
und zwei CPU-Kernen. Vor der oben dokumentierten Maßnahme gab es keinen Swap;
aktuell stehen 4 GiB bereit, jedoch ohne automatische Aktivierung nach Neustart.
Ein vorheriger unbegrenzter Build verursachte starken Speicherdruck und zeitweise
unerreichbare Dienste. Der ausschließlich für serien.de vorgesehene Builder
begrenzt BuildKit einschließlich seiner RUN-Prozesse.

- Ausschließlich Branch `codex/takeover` verwenden. `main` weder ändern noch mergen oder deployen.
- Vor Änderungen aktuelle Datenbank- und Volume-Sicherungen einschließlich erfolgreicher Wiederherstellung verifizieren. Ein vorhandener Dateiname allein genügt nicht.
- Keine Produktionsmigration, Datenwiederherstellung oder Secret-Rotation als Teil eines Builds.
- Der Nutzer hat den privilegierten, begrenzten Builder am 21. September ausdrücklich freigegeben. Diese Freigabe ist keine allgemeine Erlaubnis für weitere privilegierte Dienste.
- Geheimnisse und Datenbank-URLs weder anzeigen noch in Prüfprotokolle übernehmen.

## Aktuelle verifizierte Konfiguration

| Eigenschaft | Wert |
| --- | --- |
| Builder | `serien-bounded`, Driver `docker-container` |
| Container | `buildx_buildkit_serien-bounded0` |
| BuildKit | `moby/buildkit:v0.31.1@sha256:6b59b7df63a8cb9902736f9ddf7fcff8261613d3e7449b8ea8b7537fc399c03a` |
| Speicher | 1024 MiB, `memory.max=1073741824` |
| Swap | maximal zusätzlich 2048 MiB, `memory.swap.max=2147483648` |
| CPU | 0,75 CPU, `cpu.max=75000 100000` |
| Gleichzeitige Build-Schritte | `max-parallelism=1` |
| Netzwerk | `network=host`, entsprechend dem bisherigen Coolify-Buildpfad |
| Image-Ausgabe | `default-load=true`, fertige Images im lokalen Docker-Image-Store |
| Neustartregel | `restart-policy=no` |
| Host-Buildx | 0.35.0 |
| Coolify-Helper | `coollabsio/coolify-helper:1.0.16`, Buildx 0.36.1 |
| Globaler Standard-Builder | unverändert `default` |

Die Konfiguration liegt unter `/data/coolify/serien-build.uNkYnX/buildkitd.toml`:

```toml
[worker.oci]
  max-parallelism = 1
```

Es wird kein BuildKit-TCP-Port veröffentlicht. Host-Netzwerk ist keine zusätzliche Datenbankfreigabe; es erhält die Netzwerksemantik des bisherigen `docker build --network host`.

## Nachweis der Begrenzung

Vor der endgültigen Einstellung wurde derselbe Builder mit 256 MiB und einer halben CPU geprüft:

1. Ein kleiner Node-Build mit begrenzter Speicherbelegung lief erfolgreich und exportierte sein Image lokal.
2. Die Host-cgroup des tatsächlichen RUN-Prozesses lag unter dem Builder-cgroup: `/system.slice/docker-d1fecf51cab42c6f2cfb02c1a4c9dcda2d779182fa512cc5db7f1c3deb6bd94f.scope/buildkit/...`. Der äußere Speichergrenzwert war `268435456`, die CPU-Grenze `50000 100000`.
3. Eine negative Probe mit höchstens 384 MiB angeforderter, tatsächlich beschriebener Buffer-Belegung scheiterte mit `ResourceExhausted`. Der cgroup-Zähler `oom_kill` stieg von 0 auf 1. Die öffentliche Website lieferte anschließend weiterhin HTTP 200. Node und BuildKit benötigen zusätzlich eigenen Speicher; 384 MiB war die feste Obergrenze der Testallokation, nicht des gesamten Prozesses.
4. Danach wurden zunächst sowohl die vollständigen Builder-Metadaten als auch die bestehende Docker-Container-Konfiguration auf 640 MiB aktualisiert. Dieser historische Zwischenstand ist durch die oben dokumentierten und im Kernel geprüften Grenzen des erfolgreichen Rollouts ersetzt.
5. Ein separater Test mit dem tatsächlichen Coolify-Helper, gemeinsamem Host-Buildx-Verzeichnis und Docker-Socket verwendete nachweislich `serien-bounded` mit Driver `docker-container`. `docker build --network host` und lokaler Image-Import waren erfolgreich. Der Test erhielt keine Anwendungssecrets und griff nicht auf die Datenbank zu.

Private Prüfprotokolle: `positive.log`, `negative.log` und `integration.log` im Verzeichnis `/data/coolify/serien-build.uNkYnX/`. Keine dieser Proben bestätigt bereits einen erfolgreichen Next.js-Produktionsbuild.

## Einbindung in Coolify

`BUILDX_BUILDER=serien-bounded` wurde über die Coolify-Oberfläche gespeichert: **Buildzeit aktiv, Laufzeit deaktiviert**. Coolify hat den Eintrag automatisch auch für Preview übernommen. Die gespeicherten Flags wurden geprüft.

Die installierte Coolify-Version mountet die Host-Buildx-Metadaten in den Helper und exportiert Buildzeitvariablen vor dem Docker-Befehl. Damit wirkt die Auswahl auch bei `docker build`; ein bloßes `docker buildx use` wäre dafür nicht ausreichend.

Vor einem Deployment:

- Backup- und Restore-Nachweise, Branch und Zielcommit erneut prüfen; News während des kontrollierten Rollouts pausiert lassen.
- Öffentliche Gesundheit, Anwendungs-/Datenbankstatus, verfügbaren RAM und freien Datenträgerplatz erfassen.
- Aktiven 4-GiB-Host-Swap ausdrücklich prüfen; die Datei allein beweist keine Aktivierung. Nach einem Host-Neustart keinen ungeschützten automatischen Build starten.
- Builder-Metadaten, Containerlimits und tatsächliche cgroup-Grenzen prüfen. Keine parallel laufenden Builds starten.
- Im Build-Protokoll muss der benannte Builder mit Driver `docker-container` erscheinen. Bei einem anderen Builder abbrechen, nicht ungeschützt fortfahren.
- Speicherreserve und öffentliche Erreichbarkeit während Build **und Image-Import** beobachten. Mit aktivem Swap warnen unter 384 MiB verfügbar; stoppen unter 128 MiB sofort, unter 256 MiB in vier aufeinanderfolgenden 5-Sekunden-Proben, bei weniger als 512 MiB freiem Swap oder 4 GiB freier Platte. Der aktuelle Cursor-Rollout nutzt diese 4-GiB-Plattengrenze; der frühere Lauf nutzte 6 GiB. Zwei aufeinanderfolgende Origin-/Public-Fehler oder vier Proben mit Memory-Full-PSI über 20 und unter 384 MiB Reserve stoppen ebenfalls ausschließlich den Builder. Dies ist ein beobachteter Betriebsschutz, keine allgemeine Verfügbarkeitsgarantie. Vor jedem Folgebuild Platzbedarf und Reserve neu bewerten, keine automatische Grenzabsenkung oder Bereinigung.

## Fehlerbehandlung und Rückweg

Der frühere 640-MiB-Versuch wurde abgebrochen; der aktuelle begrenzte Build mit
1024 MiB RAM und Swap bestand. Das garantiert keinen beliebigen künftigen
Build oder ausreichend Reserve unter anderer Produktionslast. Bei OOM oder
anhaltender Ressourcenknappheit keine automatische Wiederholung und keine
ungeprüfte Erhöhung des Limits.

Wenn möglich zunächst das betroffene Deployment in Coolify abbrechen. Falls der Build weiterläuft, ausschließlich den zugehörigen Builder stoppen:

```sh
docker stop --time 10 buildx_buildkit_serien-bounded0
```

Danach Produktionscontainer, Datenbank und öffentliche Erreichbarkeit prüfen. Weder Docker-Daemon noch Produktionscontainer stoppen. Kein `compose down`, kein globales Pruning und keine Daten-/Volume-Löschung. Builder-Cache und Konfiguration zur Untersuchung erhalten. Auto-Deploy bleibt trotz dieses erfolgreichen Builds manuell, insbesondere wegen der nicht persistenten Swap-Aktivierung und der nötigen Vorprüfungen.

Für eine spätere Ressourcenänderung reicht `buildx create --name ... --node ...` allein nicht: Es aktualisiert Metadaten und ersetzt die Driver-Optionen vollständig, passt aber einen vorhandenen Container nicht automatisch an. Deshalb vollständige Optionen erhalten, zusätzlich gezielt `docker update` verwenden und anschließend HostConfig **und** Kernel-Grenzen prüfen. Nur ohne laufenden Build ändern.

Ein vollständiger Rückbau kann den Builder mit `docker buildx rm --keep-state serien-bounded` entfernen und den Cache bewahren. Vorher sicherstellen, dass kein Build läuft und keine automatische Wiederanlage ansteht. Die Auswahlvariable nicht entfernen und anschließend ungeschützt deployen.

## Verbleibende Risiken und Abnahme

Die Grenze umfasst BuildKit und seine nachgewiesen untergeordneten RUN-Prozesse. Der Host-Docker-Daemon sowie Teile von Image-Pull/-Import liegen außerhalb dieser Grenze. Auch Datenträger-I/O und Produktionslast benötigen Reserve. Die Begrenzung ist kein Schutz gegen bösartigen Code innerhalb eines privilegierten Builders; ausschließlich vertrauenswürdigen Projektcode bauen.

Erst nach erfolgreichem vollständigem Build, geprüftem Zielcommit, gesundem neuen Container sowie sichtbarer Website darf das Deployment als live gelten. Die News-Automatik benötigt zusätzlich die kontrollierte Prüfung eines echten Artikels einschließlich Bild und öffentlicher Sichtbarkeit. Ein bestandener Canary ersetzt diese Abnahme nicht.

## Technische Referenzen

- [Docker: Container-Builder und Ressourcenoptionen](https://docs.docker.com/build/builders/drivers/docker-container/)
- [Docker: Builder-Auswahl bei docker build](https://docs.docker.com/build/builders/#difference-between-docker-build-and-docker-buildx-build)
- [Docker: dynamische Containerlimits](https://docs.docker.com/reference/cli/docker/container/update/)
- [Offizieller BuildKit-Release v0.31.1](https://github.com/moby/buildkit/releases/tag/v0.31.1)
