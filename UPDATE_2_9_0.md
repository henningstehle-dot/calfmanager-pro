# CalfManager Pro 2.9.0 – Testversion (Build noch nicht verifiziert)

## Änderungen
- Dashboard: Gesundheitsring mit Anzahl aktiver Kälber und anklickbaren Gesundheitsfiltern in der Legende.
- Kälberliste: Filter für grün/gelb/rot, der über das Dashboard vorbelegt werden kann.
- Neue Stallübersicht mit aktiven Kälbern nach Box/Gruppe sowie Auswahl für einen Boxenwechsel.
- Boxenverwaltung von Einstellungen in die Stallübersicht verschoben.
- Dashboard: Liste der zuletzt erfassten Kälber zeigt nur aktive Kälber.

## Installation
Keine neue Datenbankmigration erforderlich: verwendet bestehende `farm_boxes` und `calves.box_id`.
Die vorherige Korrektur der widersprüchlichen Status-Constraints muss in der Datenbank bereits erfolgt sein.

## Buildprüfung
Lokaler `npm install --offline` fehlgeschlagen: npm-Pakete sind nicht im Cache. Ein globaler TypeScript-Parserlauf zeigte keine Syntaxfehler, konnte aber wegen fehlender React-/Supabase-Typen keine vollständige Typprüfung ausführen. GitHub Actions muss den Build bestätigen.

## Test
1. Dashboard: Anzahl aktiver Kälber, Grün/Gelb/Rot-Filter.
2. Stallübersicht: Gruppen und nicht zugeordnete Kälber.
3. Boxenwechsel: speichern, Seite neu laden, prüfen.
4. Neue Box anlegen (Betriebsinhaber).
5. Archivierte Kälber dürfen nicht mitgezählt werden.
