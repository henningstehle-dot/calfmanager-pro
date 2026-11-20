# CalfManager Pro 2.7.0 – Testpaket

## Installation
1. Bestehende Supabase-Datenbank sichern.
2. `supabase/migration_2_7_0.sql` im Supabase SQL Editor ausführen.
3. Erst nach erfolgreicher Migration Projektdateien zu GitHub hochladen.
4. GitHub Actions Build prüfen und App testen.

## Funktionen
Gesundheitsmonitor, Krankheitsfälle, Medikamente, Behandlungen, Impfungen, Nachkontrollen, Gesundheitsakte.
Rot → Grün: Bestätigung und optionale Schließung offener Krankheitsfälle.
MAT-Rechner: Berechnung immer sichtbar, Erklärung auf Klick.

## Einschränkungen
Keine echten Push-Benachrichtigungen; Fälligkeiten werden in der App angezeigt.
Automatische Tests/TypeScript-Build konnten in der Arbeitsumgebung mangels installierter npm-Abhängigkeiten nicht ausgeführt werden.
**Dieses Paket ist daher noch nicht buildverifiziert.**
