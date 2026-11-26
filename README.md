# CalfManager Pro 3.2.2

Mobile Web-App für die tägliche Kälberarbeit im Stall. CalfManager Pro verwendet React, TypeScript, Vite und Supabase. Das Frontend läuft als installierbare PWA auf GitHub Pages. Supabase trennt die Daten der Betriebe über Row Level Security.

## Version 3.2.2

Die Release-Anleitung beschreibt Neuerungen, Voraussetzungen, die Reihenfolge für Datenbank- und App-Updates sowie die Wiederherstellung bei Fehlern. [Release- und Installationsanleitung](RELEASE-3.2.2.md)

## Lokal starten

Verwendet eine aktuelle Version von Node.js 22 ab 22.18. Kopiert `.env.example` nach `.env.local` und tragt `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` für ein lokales Backend ein. Verwendet im Frontend den Publishable- oder Anon-Key.

```bash
npm ci
npm test
npm run build
npm run dev
```

Die App ist standardmäßig unter `http://localhost:5173` erreichbar. Frische lokale Datenbanken benötigen ein vollständiges Schema der Ausgangsversion 3.2.1 und anschließend die Migration für 3.2.2. [Hinweise zum lokalen Schemaaufbau](RELEASE-3.2.2.md#lokale-installation)

## GitHub Pages

Der bestehende Workflow baut das Frontend mit den Actions-Variablen `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` und veröffentlicht bei einem Push auf `main`. Die GitHub-Pages-Adresse muss in der Supabase-URL-Konfiguration als Rücksprungziel hinterlegt sein. [Deployment-Workflow](.github/workflows/deploy.yml)
