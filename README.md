# CalfManager Pro – Testversion 1.0.0

Neue, responsive React/TypeScript-Anwendung mit Supabase Auth, PostgreSQL und betriebsbezogener RLS.

## Was funktioniert
- Selbstregistrierung, Anmeldung, Passwort-Reset (E-Mail-Konfiguration erforderlich)
- Eigenen Betrieb anlegen und zwischen Betrieben wechseln
- Kälber anlegen, bearbeiten, löschen und suchen
- Gesundheits-, Gewichts-, Fütterungs- und Aufgabeneinträge erfassen und anzeigen
- Mehrere Mitarbeiter pro Betrieb: bereits registrierte, bestätigte Konten hinzufügen
- Betriebsdaten serverseitig durch Row Level Security getrennt
- Plattformadministrator-Rolle (noch ohne globale Benutzerverwaltung)

## 1. Supabase einrichten
1. Neues Supabase-Projekt erstellen.
2. **SQL Editor** öffnen und `supabase/schema.sql` vollständig ausführen (einmalig auf leerem Projekt).
3. Unter **Authentication → Providers → Email** E-Mail-Registrierung konfigurieren. Für echte Testnutzer E-Mail-Bestätigung aktivieren und SMTP-Versand prüfen.
4. Unter **Authentication → URL Configuration** die spätere GitHub-Pages-Adresse als Site URL und Redirect URL eintragen. Für lokale Tests `http://localhost:5173` hinzufügen.
5. In **Project Settings → API** die Project URL und den **publishable/anon** Key kopieren. Niemals `service_role` oder Secret Keys im Frontend verwenden.
6. Erstes Konto über die Anwendung registrieren. Danach im SQL Editor den Kommentar am Ende von `schema.sql` verwenden, um dieses Konto zum Plattformadministrator zu machen. **Die E-Mail im SQL-Befehl ersetzen.**

## 2. Lokal starten
```bash
npm install
cp .env.example .env
# In .env die zwei VITE_ Werte eintragen
npm run dev
```
Unter Windows `.env.example` manuell als `.env` kopieren. Zum Prüfen: `npm run build`.

## 3. GitHub Pages
1. Eigenes **öffentliches** GitHub-Repository `calfmanager-pro` anlegen und Projektdateien hochladen (`.env` niemals hochladen).
2. Unter **Settings → Secrets and variables → Actions → Secrets** die Werte `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` eintragen.
3. Unter **Settings → Pages** als Source **GitHub Actions** auswählen.
4. Workflow `.github/workflows/deploy.yml` ausführen. GitHub Pages URL: `https://BENUTZERNAME.github.io/calfmanager-pro/`.
5. Diese URL in Supabase Authentication → URL Configuration hinterlegen.

**Sicherheitshinweis:** GitHub Pages ist ein öffentlicher statischer Host. Der Publishable Key darf öffentlich sein; die Sicherheit hängt von RLS und korrekt eingerichteten Supabase-Richtlinien ab. Keine echten Tiergesundheitsdaten eingeben, bevor die Rechte mit zwei getrennten Testbetrieben geprüft wurden.

## Grenzen der ersten Testversion
- Mitarbeiter werden über ihre bereits registrierte E-Mail-Adresse hinzugefügt; automatische Einladungs-E-Mails und Rollenwechsel fehlen noch.
- Noch keine globale Admin-Benutzerliste, Kontosperrung oder Mitarbeiterentfernung.
- Aufgaben sind dokumentierte Einträge, noch ohne Fälligkeit/Erledigt-Status oder Push-Erinnerungen.
- Fütterung ist zunächst eine Dokumentation, noch kein automatisierter Fütterungsplan.
- Noch keine Abos, Exporte, Offline-Nutzung oder Datei-Uploads.
- Für Produktion: vollständige RLS-Tests, Datenschutzkonzept, Backups, Betriebs-/Mitarbeiter-Lifecycle und rechtliche Prüfung ergänzen.
