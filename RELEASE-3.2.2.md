# CalfManager Pro 3.2.2

Version 3.2.2 erweitert die Stallarbeit um Aufgabenvorlagen, Einzel- und Gruppenaufgaben sowie einen MAT-Rechner auf der Fütterungsseite. Ausgangspunkt ist die freigegebene App 3.2.1 im Commit `144db00`. Die Änderungen liegen im Entwicklungsbranch `entwicklung-3-2-2`.

## Stallarbeit und Betriebseinstellungen

- Betriebsinhaber pflegen Aufgabenvorlagen und MAT-Angaben in den Einstellungen. Berechtigte Betriebsmitglieder können Aufgaben anlegen, erledigen und beenden. Beim Zuweisen lassen sich Beginn, Häufigkeit, Dauer und Bemerkung für das einzelne Kalb oder die gewählte Gruppe anpassen. Bereits zugewiesene Aufgaben behalten ihre Angaben, wenn sich eine Vorlage ändert.
- Die Aufgabenansicht ordnet Durchführungen in **Heute**, **Überfällig**, **Geplant** und **Heute erledigt**. Die Dashboard-Zahl zählt offene fällige Durchführungen. Zwei tägliche Durchführungen werden einzeln abgehakt. Für eine wiederkehrende Aufgabe zeigt **Geplant** den jeweils nächsten zukünftigen Tag.
- Bei der Gruppenzuweisung lässt sich eine Box vollständig auswählen oder aufklappen, um einzelne Kälber anzuwählen. Aktive Kälber ohne Box sind ebenfalls auswählbar. Die Zuweisungen bleiben nach einem Standortwechsel beim Tier.
- Neue Erledigungen erhalten den tatsächlichen Zeitpunkt und das ausführende Benutzerkonto. Die dokumentierten Durchführungen erscheinen im Kälberprofil unter **Historie**. Nach dem Beenden einer Aufgabe bleiben dokumentierte Durchführungen und die Gesundheitsakte erhalten. Die Tierhistorien archivierter und ausgeschiedener Kälber sind über **Archiv und Abgänge** erreichbar. Deren offene Aufgaben entfallen aus der Tagesarbeit. Die medizinische Dokumentation nutzt weiterhin die bestehenden Behandlungsvorlagen und Behandlungsfunktionen.
- Der MAT-Rechner übernimmt die betriebliche Mischvorgabe. Als Eingabe dienen die fertige MAT-Menge oder der Gesamtbedarf und der verfügbare Vollmilchanteil. Die Anmischangabe des Herstellers bestimmt den Wasserbedarf. Die Pulvermenge bezieht sich je nach Herstellerangabe auf einen Liter Wasser oder einen Liter fertige Tränke.

## Lokale Installation

Verwendet entsprechend dem GitHub-Actions-Workflow eine aktuelle Version von Node.js 22 ab 22.18. Kopiert `.env.example` nach `.env.local` und tragt die URL und den Publishable- oder Anon-Key des lokalen Supabase-Projekts ein.

```bash
cp .env.example .env.local
```

```dotenv
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<lokaler Publishable- oder Anon-Key>
```

```bash
npm ci
npx tsc --noEmit
npm test
npm run build
npm run dev
```

Die App läuft standardmäßig auf `http://localhost:5173`. `.env.local` gehört nicht ins Repository. Serverseitige Supabase-Schlüssel bleiben außerhalb des Frontends. Für ein vollständiges lokales Backend benötigt ihr ein geeignetes Schemaabbild der freigegebenen Version 3.2.1. Die Ausgangsdatei `supabase/schema.sql` und die älteren Migrationen bilden nur den im Repository dokumentierten Stand bis 2.8.0 ab. Die SQL-Definitionen für den dazwischenliegenden produktiven Schemaaufbau sind im Repository nicht enthalten.

Die Freigabeprüfung verwendet den separat bereitgestellten Schemaexport von 3.2.1. Der folgende Befehl legt dafür einen temporären PostgreSQL-17.12-Container ohne Netzwerkzugriff an und erzeugt synthetische Daten. Verwendet dazu einen reinen Schemaexport.

```bash
bash tests/postgres-322.sh /pfad/zu/CalfManager_v3.2.1_Schema.sql
```

## Technische Freigabeprüfung

Die Migration übernimmt Datum, Uhrzeit und Benutzer bereits protokollierter Altaufgaben aus der vorhandenen Erledigungstabelle. Die bisherige Planungsfunktion und Medikamentendokumentation bleiben über den 3.2.1-Endpunkt erreichbar. Die bestehenden RLS-Regeln für die Mindestzunahme erhalten die von beiden App-Versionen benötigten Tabellenrechte.

Der Löschschutz hält dokumentierte Behandlungen, Impfungen und abgeschlossene Nachkontrollen fest. Zulässige Korrekturen in der Gesundheitsakte und das Entfernen eines offenen Nachkontrollentwurfs sind möglich. Beim Löschen eines zulässigen Kontos kann PostgreSQL weiterhin eine alte optionale Aufgabenzuweisung auflösen. Historisch referenzierte Konten unterliegen weiterhin den bestehenden Fremdschlüsseln aus 3.2.1.

## Datenbank vor App aktualisieren

1. Haltet den letzten funktionsfähigen App-Stand 3.2.1 bereit und erstellt vor dem Wartungsfenster eine überprüfte Sicherung des Supabase-Projekts. Berücksichtigt Datenbank, Auth-Daten und gegebenenfalls Storage. Haltet Sicherungszeitpunkt und Wiederherstellungsweg fest.
2. Vergleicht die im Kopf von `supabase/migration_3_2_2.sql` geprüften Objekte mit dem Zielsystem. Führt die Datei zuerst vollständig auf einem isolierten lokalen Schemaabbild von 3.2.1 aus.
3. Prüft lokal die vorhandenen Behandlungsvorlagen, die Behandlungshistorie und mindestens einen Bestandsdatensatz mit einer offenen Aufgabe. Meldet euch getrennt als Inhaber, Mitarbeiter und Nutzer eines zweiten Betriebs an und kontrolliert die Sichtbarkeit und Berechtigungen.
4. Führt im freigegebenen Wartungsfenster die vollständige Datei `supabase/migration_3_2_2.sql` im Supabase SQL Editor als `postgres` aus. Der bestehende Behandlungstrigger erwartet diese Rolle bei internen Änderungen. `BEGIN` und `COMMIT` gehören zur Datei. Bei einem Fehler prüft die Meldung und den Schemastand vor einem weiteren Lauf.
5. Prüft nach der Migration die bestehende App 3.2.1 mit einem Betriebsinhaber- und einem Mitarbeiterkonto. Kontrolliert die Anmeldung, das Laden des Betriebes und die Sichtbarkeit vorhandener Behandlungen.
6. Gebt danach die App 3.2.2 zur Veröffentlichung frei. Der bestehende GitHub-Actions-Workflow baut mit den Repository-Variablen `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` und veröffentlicht bei einem Push auf `main`. Der Workflow lässt sich auch manuell auslösen. Ein Push auf den Entwicklungsbranch führt allein zu keinem Deployment.
7. Öffnet die App online und kontrolliert die Versionsanzeige. Der Service Worker verwendet den App-Cache `calfmanager-shell-v3-2-2`. Bei einem noch wartenden Service Worker schließt alle offenen Tabs und PWA-Fenster der Anwendung und öffnet die App danach erneut online.
8. Prüft nach der Freigabe die Anzeige der Aufgaben und den Dashboard-Zähler im Testbetrieb. Hinterlegt als Inhaber die Mischdaten des verwendeten MAT-Produkts und vergleicht ein Rechenergebnis mit der Herstelleranleitung.

## Wiederherstellung bei Fehlern

- **Fehler während der Migration.** Bei einem SQL-Fehler kann die Transaktion nicht erfolgreich abgeschlossen werden. Prüft den Schema- und Datenstand sowie die genaue PostgreSQL-Meldung, bevor ihr einen weiteren Lauf startet. Belasst die App bis zur Klärung auf 3.2.1.
- **Fehler nach Veröffentlichung der App.** Stellt zuerst den zuletzt funktionierenden App-Build über den etablierten Freigabeweg wieder her. Lasst den erweiterten Datenbankstand samt seitdem erfassten Durchführungen bestehen. 3.2.1 verwendet die bisherige Aufgabenansicht. Dort können beendete Alteinträge noch sichtbar sein. Die vollständige Serienübersicht mit den Beendigungsinformationen wird in 3.2.2 wieder angezeigt. Schließt nach dem App-Wechsel alle offenen App-Fenster und öffnet die App online, damit der Service Worker die passende Version übernimmt.
- **Datenbank-Wiederherstellung erforderlich.** Stoppt Schreibzugriffe, sichert zusätzlich den aktuellen Stand und stellt die Sicherung zuerst in einer isolierten Umgebung wieder her. Prüft dort Benutzerkonten, Betriebszuordnung und Gesundheits- und Aufgabenhistorien. Sichert neue Einträge seit dem Sicherungszeitpunkt. Für die Aufgabenhistorie gehören die Durchführungen in `calf_events` und ihre Aufgabenzuordnungen zusammen.
- **PWA zeigt einen alten Stand.** Prüft zuerst das Online-Laden nach dem Schließen aller App-Fenster. Vermeidet das Löschen der Browser-Websitedaten, solange auf dem Gerät Offline-Wiegungen zur Synchronisation ausstehen.

## Bekannte Grenzen

- Aufgabenänderungen benötigen eine Serververbindung. Offline zeigt die App den letzten geladenen Aufgabenstand des angemeldeten Nutzers für den gewählten Betrieb an. Der vorhandene Offline-Weg für Wiegungen steht weiterhin zur Verfügung.
- Der Aufgabenkalender verwendet die Zeitzone `Europe/Berlin`. Für eine wiederkehrende Aufgabe sind bis zu 24 Durchführungen pro Tag einstellbar. Eine feste Laufzeit beträgt höchstens 3.660 Tage. Unbegrenzte Aufgaben laufen bis zur manuellen Beendigung.
- Unter **Geplant** zeigt eine wiederkehrende Aufgabe jeweils ihren nächsten künftigen Termin.
- Zusammengehörige alte Behandlungsaufgaben werden anhand ihrer vorhandenen Serienkennung erkannt. Fehlt die Kennung, lassen sich die offenen Alteinträge einzeln beenden.
- Für den Wasserbedarf benötigt der Rechner ein Herstellerbeispiel mit Wasser- und Fertigmenge. Die Migration übernimmt die bisherige Pulverkonzentration, wenn alle MAT-Tränkekurven des Betriebs dieselbe Konzentration verwenden. Prüft die übernommene Konzentration und hinterlegt die Herstellerangaben zum verwendeten Produkt.
- Der lokale Schema-Test verwendet das bereitgestellte 3.2.1-Schema, synthetische Daten und eine Nachbildung von Supabase Auth. Die verwalteten Auth- und Edge-Function-Dienste, einschließlich `admin-delete-user`, waren außerhalb der Prüfumgebung. Geprüft wurden die vorhandenen Admin-RPCs und die Datenbankoperation der Kontolöschung.

## Ausgeführte Prüfungen

- `npm ci` installierte die 94 Pakete aus der Lockdatei in einem leeren Arbeitsverzeichnis. `tsc --noEmit` und `npm run build` waren mit Node.js 22.23.5 erfolgreich. Der Build verwendete den GitHub-Pages-Pfad und lokale Platzhalter für Supabase. Vite meldete für den größeren JavaScript-Chunk 559 kB minifiziert, davon 158 kB gzip-komprimiert.
- Die unveränderte Ausgangsversion 3.2.1 bestand alle 7 Release-Tests im separaten Checkout.
- `npm test` unter Node.js 22.23.5 bestand alle 22 Tests. Darunter sind 7 Release-Tests, 10 MAT-Tests und 5 Aufgaben-Tests. Geprüft wurden beide MAT-Eingabemodi und Konzentrationsbezugsgrößen, die Herstellerausbeute, Nullbedarf und ungültige Eingaben sowie Aufgabentermine über die Zeitumstellung, Boxauswahl, Abhaken je Box, Dashboard-Zahl und die Offline-Anzeige vorhandener Aufgaben.
- `bash tests/postgres-322.sh` wendete die vollständige Migration lokal in PostgreSQL 16 an und bestand alle SQL-Prüfungen. Das temporäre Docker-System verwendete die vorhandenen Migrationen, nachgebildete Supabase-Authentifizierung und Testdefinitionen für die fehlenden 3.x-Objekte. Geprüft wurden Rollenrechte und Betriebstrennung, die vollständige oder ausbleibende Gruppenanlage bei Fehlern, Wiederholungen, Tageswechsel, Standortwechsel, Archivierung, Beendigung und Historie, vorhandene Behandlungen und Gesundheitsmaßnahmen sowie MAT-Konzentrationsübernahme und Eingabegrenzen. Zwei unabhängige PostgreSQL-Sitzungen bestätigten dieselbe Durchführung gleichzeitig. Genau eine Durchführung wurde gespeichert.
- Die abschließende SQL-Prüfung unter PostgreSQL 17.12 spielte den bereitgestellten Originalexport ein, legte darin vor der Migration eine Behandlung an und prüfte die protokollierte Gabe nach der Migration. Sie deckte die Rücknahme einer absichtlich fehlgeschlagenen Migration, die weitere Nutzung der 3.2.1-RPCs, RLS, Tabellenrechte, Admin-RPCs, Kontolöschung, Behandlungskorrekturen, Löschschutz sowie die vollständige Aufgaben- und MAT-Suite ab. Zwei gleichzeitige Bestätigungen speicherten genau eine Durchführung.
- Die unveränderte App 3.2.1 aus Commit `144db00` wurde nach der Migration in mobilem Chromium mit PostgREST 13.0.5 und PostgreSQL 17.12 geprüft. Mit synthetischer Anmeldung funktionierten die Anzeige des Betriebs, das Speichern der Mindestzunahme und die Bestätigung einer geplanten Medikamentengabe. Grenzwert und Medikamentenprotokoll wurden anschließend in der Datenbank kontrolliert.
- `node tests/browser.mjs` bestand mit simuliertem Backend in Chromium 156.0.8078.79. Mobil bei 390 × 844 Pixeln wurden Einzel- und Gruppenaufgaben, Fehler und Wiederholung beim Anlegen, der Tageswechsel, Beendigung und Historie einschließlich ausgeschiedener Kälber, Dashboard-Zähler, beide MAT-Modi, Behandlungen, Fütterung und Offline-Wiegungen geprüft. Auf dem Desktop bei 1366 × 900 Pixeln wurden die Vorlagenbearbeitung, MAT-Einstellungen, Mitarbeiterrechte und zwei konkurrierende Bestätigungen gegen das simulierte Backend geprüft.
- `node tests/pwa-browser.mjs` bestand in mobilem Chromium bei 390 × 844 Pixeln. Der Test wechselte vom Service Worker 3.2.1 zum tatsächlich gebauten Stand 3.2.2, kontrollierte die Wartephase, den Cache-Wechsel und den ersten Offline-Start nach Update und Neuinstallation.

Die Browserskripte verwenden Chromium und `playwright-core`. Für eine separate Installation setzt `CALFMANAGER_PLAYWRIGHT` auf deren Modulpfad. `CALFMANAGER_CHROMIUM` kann auf eine andere Chromium-Installation zeigen. Für die Prüfung des Service-Worker-Wechsels muss der Commit `144db00` im lokalen Git-Verlauf verfügbar sein. Geprüft wurde in emulierten Ansichten. Echte Mobilgeräte und Safari blieben ungeprüft.
