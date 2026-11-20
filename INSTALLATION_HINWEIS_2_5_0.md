# CalfManager Pro 2.5.0 – Prüfstand, noch nicht freigegeben

Dieser Quellcode basiert auf dem Entwicklungsstand 2.5.0 und enthält Rasse, Muttertier, Boxenverwaltung, manuelle Gesundheitsampel und Kamera-Ausrichtung.

**Nicht produktiv installieren:** npm-Abhängigkeiten konnten in der Arbeitsumgebung nicht bezogen werden (DNS EAI_AGAIN). Deshalb sind TypeScript- und Vite-Build sowie Laufzeittests noch ausstehend. Supabase-Migration wurde nicht auf einer realen Datenbank getestet.

## Vor Freigabe
1. `npm ci` (oder `npm install` bei fehlendem Lockfile) und `npm run build` ausführen.
2. SQL-Migration `supabase/migration_2_5_0.sql` zuerst auf einer Testdatenbank mit bestehenden Daten prüfen.
3. Neue Boxen, Muttertier, Rasse und manuelle Gesundheitsampel mit Mitarbeiter- und Inhaberkonto testen.
4. PWA-Upgrade inklusive Offline-Neustart und OCR prüfen.

Hinweis: Status Rot kennzeichnet behandlungsbedürftig. Das automatische Anlegen einer dokumentierten medizinischen Behandlung ist noch nicht umgesetzt; dafür ist Version 2.7.0 vorgesehen.
