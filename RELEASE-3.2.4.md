# CalfManager Pro 3.2.4

- Dashboard-Kacheln für die vier Bereiche der Boxenübersicht; Gruppen- und Einzelumstallungen, Abgänge und Boxenverwaltung bleiben verfügbar.
- Einstellungen: separate Kacheln für Tränkekurven und MAT, keine vier alten Summenkacheln. Kurveneditor erst nach Auswahl, responsive SVG-Vorschau mit auswählbaren Altersstufen; lineare Verbindung entsprechend der vorhandenen Mengenberechnung.
- Gewichtsverwaltung aus der Navigation und dem Kälberprofil ausgeblendet. Alte Messungen und Offline-Synchronisierung bleiben erhalten. Optionales Geburtsgewicht in Anlage und Stammdaten.
- PWA-Cache und Versionsnummer aktualisiert.

## Installation

1. Vor dem Frontend-Deployment in Supabase SQL Editor `supabase/migration_3_2_4.sql` ausführen. Die Migration ergänzt eine optionale Spalte; bestehende Daten bleiben unverändert.
2. Projektdateien wie bisher in GitHub übernehmen und Deployment abwarten.
3. App neu laden und Versionsnummer 3.2.4 prüfen.

## Manuelle Abnahme

- Mit Inhaber und Mitarbeiter beide Einstellungskacheln öffnen; Kurven ansehen, als Inhaber ändern und speichern, MAT-Rechner und Einstellungen prüfen.
- Alle vier Boxenkacheln öffnen; Einzel- und Gruppenwechsel, Abgang und Boxenbearbeitung in einem Testbetrieb prüfen.
- Kalb mit und ohne Geburtsgewicht anlegen; Geburtsgewicht ändern und leeren. Alte Gewichtsdaten bleiben in der Datenbank.
- Smartphone und Desktop, PWA-Update sowie Fütterungsampel prüfen.
