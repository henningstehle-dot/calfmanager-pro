# CalfManager Pro 3.2.3

Ausgangspunkt ist die veröffentlichte Version 3.2.2 auf `main` im Commit `c6330a00f2b2743b67a8384e5d403c46245bac4c`. Die Änderungen liegen im Entwicklungsbranch `entwicklung-3-2-3`.

## Fütterungsampel

- Früh-, Mittags- und Abendrunde zeigen den aktuellen Kälberstatus aus `calves.health_status`. Gelb und Rot bleiben über den Tageswechsel erhalten, bis jemand die Ampel aktiv ändert.
- Fütterung, Kälberübersicht und Kälberprofil verwenden denselben Status. Der Wechsel von Rot auf Grün erfordert eine Bestätigung. Das Abschließen offener Krankheitsfälle ist weiterhin eine separate Entscheidung.
- Die Übernahme in eine Runde erfolgt beim Anzeigen. Ein Runden- oder Tageswechsel allein erzeugt keine Einträge. Bei einer aktiven Änderung in der Fütterung wird der Status der Runde erstmals in `calf_feeding_rounds` dokumentiert. Bereits gespeicherte Zeilen bleiben vollständig erhalten. Aktive Änderungen werden in der Gesundheitshistorie protokolliert.
- Die Fütterung verwendet weiterhin offene Gesundheitskontrollen und erhöht deren Priorität bei Rot. Bei gleichzeitig geänderter Ampel lädt die Anwendung den neueren Stand und bittet um eine erneute Auswahl.
- Ampeländerungen benötigen eine Internetverbindung. Schlägt eine Folgeaktion nach dem Speichern der Ampel fehl, meldet die Anwendung die betroffene Dokumentation oder Kontrollaufgabe.

## Datenbank und PWA

Für ein bestehendes 3.2.2-System ist keine SQL-Migration erforderlich. Der Patch verwendet die vorhandenen Tabellen, den vorhandenen eindeutigen Rundenschlüssel und die bestehenden Betriebsrechte. Bei einer Neuinstallation gelten die [Voraussetzungen aus 3.2.2](RELEASE-3.2.2.md#lokale-installation).

Die Versionsanzeige und die npm-Metadaten stehen auf `3.2.3`. Der neue Service Worker speichert die App im Cache `calfmanager-shell-v3-2-3`. Beim Aktivieren entfernt er den vorherigen App-Cache. Falls der Service Worker noch wartet, alle offenen Tabs und PWA-Fenster der Anwendung schließen und die App online erneut öffnen.

## Ausgeführte Prüfungen

| Prüfung | Ergebnis |
| --- | --- |
| `npm test` mit Node.js 22.23.5 | Alle 22 Tests bestanden. |
| `npx tsc --noEmit` und `npm run build` mit Node.js 22.23.5 | Erfolgreich mit GitHub-Pages-Pfad und lokalen Supabase-Platzhaltern. Vite meldet weiterhin einen minifizierten JavaScript-Chunk über 500 kB. |
| `node tests/browser.mjs` mit Chromium 156 | Gelb und Rot in allen Folgerunden und am Folgetag, Bestätigung und Abbruch bei Rot → Grün, Abgleich mit Kälberübersicht und Profil, unveränderte Runden- und Fütterungshistorie, veralteter Ausgangsstatus, Mitarbeiterzugriff und Betriebswechsel bestanden. Die bisherigen Browserprüfungen für Aufgaben, MAT, Behandlung und Offline-Wiegung bestanden ebenfalls. |
| `bash tests/postgres-322.sh` mit PostgreSQL 16.16 | Bestehende Aufgaben- und MAT-Prüfungen sowie die neuen SQL-Prüfungen für Mitarbeiterrechte, Betriebstrennung, Schreibschutz gespeicherter Runden durch die App-Abfrage und konkurrierende Statusänderungen bestanden. |
| `node tests/pwa-browser.mjs` mit Chromium 156 | Wechsel zwischen den gebauten Versionen 3.2.2 und 3.2.3 einschließlich Wartephase, Cache-Wechsel und erstem Offline-Start bestanden. Frische Installation mit anschließendem Offline-Start ebenfalls bestanden. |

Die Browserprüfungen verwenden ein simuliertes Supabase-Backend. PostgreSQL prüft die vorhandenen Migrationen mit synthetischen Daten und einer lokalen Nachbildung der im Repository fehlenden Definition von `calf_feeding_rounds`. Mit einem separaten schema-only Export von 3.2.1 lässt sich die SQL-Suite einschließlich der 3.2.2-Migration auch auf einem Abbild des echten Schemas ausführen. Der Export lag für diese Prüfung nicht vor. Die PWA-Prüfung benötigt den genannten 3.2.2-Commit im Git-Verlauf sowie Chromium und `playwright-core`. Bei separater Installation geben `CALFMANAGER_PLAYWRIGHT` und `CALFMANAGER_CHROMIUM` deren Pfade an.

## Technische Freigabeempfehlung

3.2.3 zur Prüfung im Entwurfs-Pull-Request freigeben. Vor dem manuellen Produktiv-Release einen kurzen Test mit Inhaber- und Mitarbeiterkonto auf einer isolierten Kopie des echten 3.2.2-Schemas durchführen. Dabei einen Statuswechsel, einen bereits gespeicherten Rundeneintrag und den Zugriff zwischen zwei Betrieben prüfen.

Die produktive Datenbank blieb unberührt. Merge und Deployment wurden nicht ausgelöst.
