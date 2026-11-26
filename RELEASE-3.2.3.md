# CalfManager Pro 3.2.3

Ausgangspunkt ist die veröffentlichte Version 3.2.2 auf `main` im Commit `c6330a00f2b2743b67a8384e5d403c46245bac4c`. Die Änderungen liegen im Entwicklungsbranch `entwicklung-3-2-3`.

## Fütterungsampel

- Früh-, Mittags- und Abendrunde zeigen den aktuellen Kälberstatus aus `calves.health_status`. Gelb und Rot bleiben über den Tageswechsel erhalten, bis jemand die Ampel aktiv ändert.
- Fütterung, Kälberübersicht und Kälberprofil verwenden denselben Status. Der Wechsel von Rot auf Grün erfordert eine Bestätigung. Das Abschließen offener Krankheitsfälle ist weiterhin eine separate Entscheidung.
- Die Übernahme in eine Runde erfolgt beim Anzeigen. Ein Runden- oder Tageswechsel allein erzeugt keine Einträge. Bei einer aktiven Änderung in der Fütterung wird der Status der Runde erstmals in `calf_feeding_rounds` dokumentiert. Bereits gespeicherte Zeilen bleiben vollständig erhalten. Aktive Änderungen werden in der Gesundheitshistorie protokolliert.
- Die Fütterung verwendet weiterhin offene Gesundheitskontrollen und erhöht deren Priorität bei Rot. Bei gleichzeitig geänderter Ampel lädt die Anwendung den neueren Stand und bittet um eine erneute Auswahl.
- Ampeländerungen benötigen eine Internetverbindung. Schlägt eine Folgeaktion nach dem Speichern der Ampel fehl, meldet die Anwendung die betroffene Dokumentation oder Kontrollaufgabe.

## Datenbank und PWA

Für ein bestehendes 3.2.2-System ist keine SQL-Migration erforderlich. Der Patch verwendet die vorhandene Tabelle `calf_feeding_rounds` mit UUID-Primärschlüssel und dem eindeutigen Rundenschlüssel aus `farm_id`, `calf_id`, `feeding_date` und `round`. Ein Fremdschlüssel bindet das Kalb an seinen Betrieb. Der Standardwert `auth.uid()` setzt den Bearbeiter beim Anlegen. Die RLS-Regeln beschränken den Zugriff auf Betriebsmitglieder und prüfen beim Anlegen den Bearbeiter. Bei einer Neuinstallation gelten die [Voraussetzungen aus 3.2.2](RELEASE-3.2.2.md#lokale-installation).

Die Versionsanzeige und die npm-Metadaten stehen auf `3.2.3`. Der neue Service Worker speichert die App im Cache `calfmanager-shell-v3-2-3`. Beim Aktivieren entfernt er den vorherigen App-Cache. Falls der Service Worker noch wartet, alle offenen Tabs und PWA-Fenster der Anwendung schließen und die App online erneut öffnen.

## Ausgeführte Prüfungen

| Prüfung | Ergebnis |
| --- | --- |
| `npm test` mit Node.js 22.23.5 | Alle 22 Tests bestanden. |
| `npx tsc --noEmit` und `npm run build` mit Node.js 22.23.5 | Erfolgreich mit GitHub-Pages-Pfad und lokalen Supabase-Platzhaltern. Vite meldet weiterhin einen minifizierten JavaScript-Chunk über 500 kB. |
| `node tests/browser.mjs` mit Chromium 156 | Gelb und Rot in allen Folgerunden und am Folgetag, Bestätigung und Abbruch bei Rot → Grün, Abgleich mit Kälberübersicht und Profil, unveränderte Runden- und Fütterungshistorie, veralteter Ausgangsstatus, Mitarbeiterzugriff und Betriebswechsel bestanden. Die bisherigen Browserprüfungen für Aufgaben, MAT, Behandlung und Offline-Wiegung bestanden ebenfalls. |
| `bash tests/postgres-322.sh /pfad/zu/CalfManager_v3.2.1_Schema.sql` mit PostgreSQL 17.12 | Originalexport eingespielt, Rücknahme einer absichtlich fehlgeschlagenen Migration geprüft und Migration auf 3.2.2 erfolgreich ausgeführt. Bestehende Aufgaben- und MAT-Tests sowie SQL-Prüfungen zu Mitarbeiterrechten, Betriebstrennung und Fütterungshistorie bestanden. |
| Mobiler Chromium 156 mit PostgREST 13.0.5 und Originalschema nach Migration | Gelb und Rot in Folgerunden und am Folgetag, Rot → Grün mit Bestätigung und Abbruch, Abgleich mit Profil und Übersicht, korrekter Bearbeiter, unveränderte gespeicherte Runden und Fütterungseinträge sowie verweigerte betriebsfremde Zugriffe bestanden. |
| `bash tests/postgres-322.sh` mit PostgreSQL 16.16 | SQL-Regressionssuite mit synthetischem Schema für lokale Entwicklung bestanden. |
| `node tests/pwa-browser.mjs` mit Chromium 156 | Wechsel zwischen den gebauten Versionen 3.2.2 und 3.2.3 einschließlich Wartephase, Cache-Wechsel und erstem Offline-Start bestanden. Frische Installation mit anschließendem Offline-Start ebenfalls bestanden. |

Für die abschließende Prüfung wurde der bereitgestellte schema-only Export von 3.2.1 in einem isolierten PostgreSQL-Container wiederhergestellt und mit synthetischen Daten und Konten befüllt. Schon vor der Migration erfasste Fütterungsdaten blieben erhalten. Der gezielte Browserlauf nutzte echtes PostgREST und die RLS-Regeln des migrierten Schemas. Die Anmeldung lieferte lokal erzeugte Testidentitäten. Die übrigen Browserprüfungen verwenden ein simuliertes Supabase-Backend. Die PWA-Prüfung benötigt den genannten 3.2.2-Commit im Git-Verlauf sowie Chromium und `playwright-core`. Bei separater Installation geben `CALFMANAGER_PLAYWRIGHT` und `CALFMANAGER_CHROMIUM` deren Pfade an.

## Technische Freigabeempfehlung

3.2.3 nach Review des Entwurfs-Pull-Requests zur manuellen Veröffentlichung auf bestehenden 3.2.2-Systemen freigeben. Die abschließende Prüfung am Originalschema nach Migration ist bestanden. Für 3.2.3 genügt das App-Update.

Die produktive Datenbank blieb unberührt. Merge und Deployment wurden nicht ausgelöst.
