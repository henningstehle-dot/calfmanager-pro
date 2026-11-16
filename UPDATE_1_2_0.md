# CalfManager Pro 1.2.0 – Update

## Enthalten
- Bestehende Funktionen aus 1.0.0: Registrierung, Betriebe, Dashboard, Kälber, Ereignisse, Team.
- Kälber: Suche nach Ohrmarke, Name und Rasse, Statusfilter, CSV-Export, Tierdetail mit Historie, Bearbeiten und Löschen.
- Gesundheit, Fütterung, Gewicht und Aufgaben: Ereignisse erfassen und löschen, Gewichtsverlauf in Tierdetails.
- Administration: geschützte, aggregierte Plattformstatistik (Betriebe, Benutzer, Kälber).
- Aktualisierte Versionsanzeige 1.2.0.

## Installation
1. Zuerst `supabase/migration_1_2_0.sql` im SQL Editor ausführen. Vorher Datenbankbackup erstellen.
2. Den **Inhalt** dieses Ordners in das vorhandene GitHub-Repository `calfmanager-pro` hochladen und bestehende Dateien ersetzen. Den `.github`-Ordner mit hochladen. Keine Zugangsschlüssel hochladen.
3. Unter GitHub Actions den Build prüfen. Bei Erfolg die GitHub-Pages-Seite neu laden.
4. Testen: Kälberfilter, CSV, Tierdetails, Ereignisse, Administratorstatistik und Datentrennung mit zwei Testkonten.

## Hinweise
- Keine Änderungen an bestehenden Datensätzen oder Tabellen durch die Migration.
- Der Plattformadministrator sieht nur Gesamtzahlen, nicht fremde Betriebsdaten.
- Einträge können gelöscht, aber noch nicht nachträglich bearbeitet werden.
- Aufgaben sind weiterhin Ereigniseinträge ohne Erledigt-Status; Fütterung ist ein Freitext-Eintrag.
- Ein vollständiger automatisierter Build konnte in der Erstellungsumgebung nicht durchgeführt werden, weil npm-Abhängigkeiten nicht verfügbar waren. GitHub Actions ist die verbindliche Build-Prüfung.
