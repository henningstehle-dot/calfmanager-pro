# CalfManager Pro 2.8.0 – TESTVERSION (Build nicht verifiziert)

Ausgangsbasis: vom Nutzer hochgeladenes GitHub-ZIP der funktionierenden Version 2.7.0.

## Installation
1. Vorher Datenbanksicherung in Supabase erstellen.
2. `supabase/migration_2_8_0.sql` im Supabase SQL Editor ausführen.
3. Erst nach Erfolg die Projektdateien in GitHub hochladen.
4. GitHub Actions prüfen und anschließend in der App testen.

## Funktionen
- Kontextbezogene Schaltflächen; Kalb anlegen nur Dashboard und Kälber.
- Ereignisformular für Gewicht, Fütterung oder Aufgabe wird je Bereich festgelegt.
- Kälberliste zeigt standardmäßig aktive Tiere, Statusfilter enthält Archiv.
- Archivierung ohne Löschung: `status='archived'`, `archived_at`, `archive_reason`.
- Reaktivierung möglich; Archivierung wird vor Ausführung bestätigt.
- Tierhistorie ergänzt Geburt und Archivierungsereignis; vorhandene Ereignisse bleiben bestehen.
- Bestehende Gesundheitsakte weiterhin im Kälberprofil abrufbar.

## Hinweise
- Lokaler Build konnte mangels installierter npm-Abhängigkeiten nicht abgeschlossen werden. GitHub Actions muss die Version verifizieren.
- Archivierung ist keine automatische Absetzung: sie erfolgt ausschließlich manuell.
- Boxenwechsel werden nur angezeigt, soweit sie als Ereignis gespeichert wurden.
