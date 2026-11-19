# CalfManager Pro 2.4.2

1. Quellcode wie gewohnt in GitHub hochladen.
2. **Einmalig** `supabase/migration_2_4_2.sql` im Supabase SQL Editor ausführen. Ohne diese Migration wird zumindest das eigene Administratorkonto aus der Nutzerliste ausgeblendet; die vollständige Admin-/Scheinbetrieb-Bereinigung benötigt die SQL-Funktion.
3. PWA auf Pixel 6a nach Update entfernen und erneut installieren, damit der Launcher das neue Icon übernimmt. Pixel Launcher kann die äußere Form selbst bestimmen.
4. Dashboard-Begrüßung steht neben dem Logo und verwendet den Profilvornamen.
5. Login-Fehlermeldungen werden übersetzt.
6. Registrierungs-E-Mail bleibt bis zur STRATO-Einrichtung unverändert.

Die SQL-Funktion blendet nur adresslose, kälberlose Betriebe aus, deren sämtliche Mitglieder Plattformadministratoren sind. Sie löscht keine Daten. Ein echter Betrieb mit Kälbern oder anderen Mitgliedern bleibt sichtbar.
