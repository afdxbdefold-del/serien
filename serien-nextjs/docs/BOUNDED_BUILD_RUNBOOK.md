# Begrenzte Builds auf dem Produktionsserver

Stand: 21. September 2026. Der Build-Schutz ist eingerichtet und getestet. Der anschließende echte Build wurde vom Sicherheitswächter abgebrochen; **kein neues Anwendungsdeployment wurde erfolgreich abgeschlossen**. Siehe [Ursachenanalyse](BUILD_INCIDENT_2026-09-21.md).

## Nachtrag: erneuter freigegebener Rollout

Nach der erneuten Live-Freigabe wurden am 21. September um 14:16 UTC beide
Backup-Prüfsummen und der logische/physische Restore-Nachweis erneut geprüft.
Anwendung und Datenbank waren gesund, jeweils ohne Neustart.

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
Heapdumps protokollieren. Noch kein erfolgreicher neuer Rollout behauptet.

## Zweck und Grenzen

serien.de, PostgreSQL und Coolify teilen einen Hetzner-Server mit 3819 MiB RAM, zwei CPU-Kernen und ohne Swap. Ein vorheriger unbegrenzter Build verursachte starken Speicherdruck und zeitweise unerreichbare Dienste. Der neue, ausschließlich für serien.de vorgesehene Builder begrenzt BuildKit einschließlich seiner RUN-Prozesse.

- Ausschließlich Branch `codex/takeover` verwenden. `main` weder ändern noch mergen oder deployen.
- Vor Änderungen aktuelle Datenbank- und Volume-Sicherungen einschließlich erfolgreicher Wiederherstellung verifizieren. Ein vorhandener Dateiname allein genügt nicht.
- Keine Produktionsmigration, Datenwiederherstellung oder Secret-Rotation als Teil eines Builds.
- Der Nutzer hat den privilegierten, begrenzten Builder am 21. September ausdrücklich freigegeben. Diese Freigabe ist keine allgemeine Erlaubnis für weitere privilegierte Dienste.
- Geheimnisse und Datenbank-URLs weder anzeigen noch in Prüfprotokolle übernehmen.

## Verifizierte Konfiguration

| Eigenschaft | Wert |
| --- | --- |
| Builder | `serien-bounded`, Driver `docker-container` |
| Container | `buildx_buildkit_serien-bounded0` |
| BuildKit | `moby/buildkit:v0.31.1@sha256:6b59b7df63a8cb9902736f9ddf7fcff8261613d3e7449b8ea8b7537fc399c03a` |
| Speicher | 640 MiB, `memory.max=671088640` |
| Swap | gesperrt, `memory.swap.max=0` |
| CPU | eine halbe CPU, `cpu.max=50000 100000` |
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
4. Danach wurden sowohl die vollständigen Builder-Metadaten als auch die bestehende Docker-Container-Konfiguration auf 640 MiB aktualisiert. Die oben genannten Kernel-Grenzen wurden erneut geprüft.
5. Ein separater Test mit dem tatsächlichen Coolify-Helper, gemeinsamem Host-Buildx-Verzeichnis und Docker-Socket verwendete nachweislich `serien-bounded` mit Driver `docker-container`. `docker build --network host` und lokaler Image-Import waren erfolgreich. Der Test erhielt keine Anwendungssecrets und griff nicht auf die Datenbank zu.

Private Prüfprotokolle: `positive.log`, `negative.log` und `integration.log` im Verzeichnis `/data/coolify/serien-build.uNkYnX/`. Keine dieser Proben bestätigt bereits einen erfolgreichen Next.js-Produktionsbuild.

## Einbindung in Coolify

`BUILDX_BUILDER=serien-bounded` wurde über die Coolify-Oberfläche gespeichert: **Buildzeit aktiv, Laufzeit deaktiviert**. Coolify hat den Eintrag automatisch auch für Preview übernommen. Die gespeicherten Flags wurden geprüft.

Die installierte Coolify-Version mountet die Host-Buildx-Metadaten in den Helper und exportiert Buildzeitvariablen vor dem Docker-Befehl. Damit wirkt die Auswahl auch bei `docker build`; ein bloßes `docker buildx use` wäre dafür nicht ausreichend.

Vor einem Deployment:

- Backup- und Restore-Nachweise, Branch und Zielcommit erneut prüfen; News während des kontrollierten Rollouts pausiert lassen.
- Öffentliche Gesundheit, Anwendungs-/Datenbankstatus, verfügbaren RAM und freien Datenträgerplatz erfassen.
- Builder-Metadaten, Containerlimits und tatsächliche cgroup-Grenzen prüfen. Keine parallel laufenden Builds starten.
- Im Build-Protokoll muss der benannte Builder mit Driver `docker-container` erscheinen. Bei einem anderen Builder abbrechen, nicht ungeschützt fortfahren.
- Speicherreserve und öffentliche Erreichbarkeit während Build **und Image-Import** beobachten. Unter 384 MiB verfügbarem RAM oder bei erneutem starken Speicherdruck den Versuch stoppen; die Grenze nicht stillschweigend erhöhen.

## Fehlerbehandlung und Rückweg

640 MiB garantieren keinen erfolgreichen Next.js-Build. Ein begrenzter Build-Abbruch ist sicherer als erneute Host-Überlastung. Bei OOM oder anhaltender Ressourcenknappheit keine automatische Wiederholung und keine ungeprüfte Erhöhung des Limits.

Wenn möglich zunächst das betroffene Deployment in Coolify abbrechen. Falls der Build weiterläuft, ausschließlich den zugehörigen Builder stoppen:

```sh
docker stop --time 10 buildx_buildkit_serien-bounded0
```

Danach Produktionscontainer, Datenbank und öffentliche Erreichbarkeit prüfen. Weder Docker-Daemon noch Produktionscontainer stoppen. Kein `compose down`, kein globales Pruning und keine Daten-/Volume-Löschung. Builder-Cache und Konfiguration zur Untersuchung erhalten. Auto-Deploy bleibt gesperrt, solange ein sicherer vollständiger Build nicht nachgewiesen ist.

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
