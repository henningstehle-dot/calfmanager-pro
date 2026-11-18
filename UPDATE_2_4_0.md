# CalfManager Pro 2.4.0 – Installierbarkeit und Offline-Gewichte

## Installation
Die vorhandenen Dateien im GitHub-Repository durch die Dateien dieses ZIPs ersetzen; Supabase-Konfiguration und GitHub-Secrets unverändert lassen. Die GitHub-Actions-Buildpipeline installiert die vorhandenen npm-Abhängigkeiten. Keine neue SQL-Migration erforderlich.

## Testablauf
1. Online anmelden und Betrieb/Kälber öffnen. Daten müssen einmal erfolgreich geladen werden.
2. PWA installieren (Android Chrome: Installieren; iPhone Safari: Zum Home-Bildschirm).
3. Netzwerk trennen, App neu öffnen: zuvor gespeicherte aktive Kälber müssen erscheinen.
4. Unter „Eintrag“ Art „Gewicht“ auswählen und erfassen; der ausstehende Eintrag muss angezeigt werden.
5. Internet aktivieren: Synchronisierung startet automatisch, alternativ „Jetzt synchronisieren“ klicken.
6. In Supabase und der Gewichtsübersicht prüfen, dass der Eintrag genau einmal vorhanden ist.
7. Einstellungen: Name anzeigen; Kälber: Ohrmarke anklickbar.

## Einschränkungen
- Offline-Gewichte können nur für bereits bekannte Kälber angelegt werden.
- Offline-Zwischenspeicher ist geräte- und browsergebunden; gelöschte Browserdaten können ihn entfernen.
- App muss für automatische Synchronisierung geöffnet sein.
- Offline-Authentifizierung und sofortige Durchsetzung entzogener Berechtigungen sind ohne Verbindung nicht möglich; die Berechtigung wird beim Server-Sync über Supabase-RLS geprüft.
- Gesundheitsdaten und neue Kälber werden nicht offline erfasst.
- Lokale IndexedDB-Daten sind nicht zusätzlich anwendungsspezifisch verschlüsselt; Gerätesperre und vertrauenswürdige Geräte sind wichtig.
- Diese Fassung wurde nicht gegen eine laufende Supabase-Instanz getestet; bitte zunächst mit Testbetrieb/Testkalb prüfen.
