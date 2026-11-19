# CalfManager Pro 2.4.4 – Nutzer-ID und Admin-Übersichten

1. In Supabase SQL Editor `supabase/migration_2_4_4.sql` ausführen. Vorher Datenbank-Backup empfohlen.
2. Projektdateien nach GitHub hochladen und GitHub Actions prüfen.
3. Im Konto die fünfstellige Nutzer-ID prüfen, auch bei einem Mitarbeiterkonto.
4. Als Plattformadministrator Nutzerliste (Vor-/Nachname) und Betriebsübersicht (Adresse) prüfen; Hofnamen anklicken, um zugehörige Mitglieder zu sehen.

Hinweise: Die ID wird für bestehende Nutzer nachgetragen und für neue Nutzer per Datenbanktrigger vergeben. Die UUIDs bleiben unverändert. Die fünfstellige Nummernfolge reicht von 10001 bis 99999; bei Erreichen der Obergrenze muss das Nummernschema erweitert werden. Nutzer-IDs werden nicht wiederverwendet. Bei offline geöffnetem Konto wird die ID derzeit nicht angezeigt. Kein vollständiger lokaler Build durchgeführt; GitHub Actions ist die erste Buildprüfung.
