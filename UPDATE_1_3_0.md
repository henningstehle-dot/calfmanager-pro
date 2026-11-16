# CalfManager Pro 1.3.0

## Änderungen
- Separate Administrator-Oberfläche ohne eigenen Betrieb
- Plattformstatistik mit Neuregistrierungen der letzten 30 Tage
- Listen registrierter Nutzer und Betriebe
- Nutzer sperren/entsperren über `admin_manage` (Supabase Auth-Hook muss separat aktiviert sein, damit eine Sperre bei Tokenausgabe greift)
- Aufgabenstatus, Priorität, Fälligkeitsdatum, Mitarbeiterzuweisung
- Milchmenge in Litern bei Fütterungseinträgen
- Mitarbeiter aus dem Team entfernen

## Voraussetzung
Die SQL-Erweiterung 1.3.0 muss **vollständig** im Supabase-Projekt ausgeführt worden sein. Erforderlich sind insbesondere `admin_list_users`, `admin_list_farms`, `admin_manage`, `remove_farm_member` sowie die neuen Spalten in `calf_events`.

## Bereitstellung
Die Dateien aus diesem Archiv in das bestehende GitHub-Repository hochladen (gleiche Verzeichnisstruktur, vorhandene Dateien ersetzen). GitHub Actions baut und veröffentlicht die Anwendung. Vorherige Daten in Supabase werden durch den GitHub-Upload nicht verändert.

## Wichtiger Hinweis
Der Build konnte in der Bearbeitungsumgebung nicht abgeschlossen werden, weil `npm install` nicht rechtzeitig fertig wurde. GitHub Actions dient daher als erste Buildprüfung. Sperren gelten ohne aktivierten Supabase Auth-Hook nicht zuverlässig für aktive Sitzungen.
