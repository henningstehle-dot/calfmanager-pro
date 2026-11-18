# CalfManager Pro 2.4.1 – Korrekturen

- Offline-Neustart: Bereits online bestätigte Benutzeridentität wird für höchstens 24 Stunden und nur bis zum Ablauf der Supabase-Sitzung lokal vorgemerkt. Keine erstmalige Offline-Anmeldung.
- Betriebsrolle wird erst nach erfolgreicher Online-Prüfung lokal gespeichert; offline werden nur zuvor geladene Betriebsdaten angezeigt.
- Beim Abmelden wird die vorgemerkte Identität entfernt. Bei erneutem Internetkontakt werden Rechte wieder beim Server geprüft.
- App-Symbole mit grünem Hintergrund, größerem CMan-Logo und maskierbarem Android-Icon.
- Service-Worker-Cache und Versionsanzeige 2.4.1.

**Sicherheit:** Offline-Zugriff kann zwischen zwei Online-Prüfungen nicht erkennen, ob Rechte serverseitig widerrufen wurden. Browser-Speicher ist kein verschlüsselter Tresor; sensible Daten nicht auf gemeinsam genutzten Geräten offline halten.

**Test:** TypeScript-Build und Verhalten auf Geräten/GitHub Actions müssen geprüft werden.
