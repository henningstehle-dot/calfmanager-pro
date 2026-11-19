# CalfManager Pro 2.4.3 – Pflichtangaben

1. Im Supabase SQL Editor `supabase/migration_2_4_3.sql` ausführen.
2. Anschließend die Projektdateien nach GitHub hochladen und GitHub Actions kontrollieren.
3. Registrierung prüfen: Vorname, Nachname, Betriebsname, Straße/Hausnummer, PLZ und Ort sind Pflichtfelder.
4. Einen neuen Betrieb nur mit vollständiger Adresse anlegen. Neue Betriebsanlage verwendet den abgesicherten RPC `create_farm_with_address`.
5. Bestehenden Betrieb ohne Adresse öffnen: Hinweis erscheint; Inhaber ergänzt die Angaben unter Einstellungen. Das Speichern unvollständiger Adressen ist nicht mehr möglich.
6. Bestehendes Konto ohne Vor-/Nachnamen: Hinweis und Link zu Mein Benutzerkonto.

Die Migration löscht keine Daten und ändert bestehende Betriebe nicht. Die alte `create_farm`-RPC wird für normale angemeldete Benutzer gesperrt, damit Betriebe nicht ohne Adresse angelegt werden können.

**Hinweis:** Die App blockiert bestehende unvollständige Betriebe nicht vollständig; sie fordert den Inhaber ausdrücklich zur Ergänzung auf. Eine komplette Sperre aller anderen Funktionen ist nicht Bestandteil dieser Version, um bestehende Abläufe und Offline-Einträge nicht zu gefährden.

**Buildstatus:** Nicht lokal verifiziert; Abhängigkeiten waren in der Umgebung nicht installierbar. GitHub Actions muss den Build prüfen.
