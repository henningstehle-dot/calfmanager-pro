# CalfManager Pro 2.4.5 – Gesundheit und Ohrmarken-OCR

## Gesundheitsampel
- Rot/Gelb anklickbar, je betroffenem Kalb ein Eintrag.
- Alle zugehörigen Warnungsgründe und Verknüpfung zum Kälberprofil.
- Bestehende Gesundheitsdaten werden weiterhin nur online geladen; bei Offlinebetrieb können Warnungen nicht aktuell sein.

## Ohrmarken-OCR
- Foto aufnehmen oder Bild auswählen; OCR über `tesseract.js` (WebAssembly).
- OCR-Text wird auf Nummern mit optionalem DE-Präfix geprüft, in das bearbeitbare Eingabefeld übernommen und gegen vorhandene Ohrmarken geprüft.
- **Wichtig:** Die OCR-Engine und englischen Sprachdaten werden beim ersten Einsatz aus dem Internet geladen und im Browser zwischengespeichert. Erst danach kann OCR bei verfügbarer Browser-Cache-Speicherung offline funktionieren. Erster Offline-Einsatz ohne zuvor geladene Daten ist nicht möglich. Die Erkennung muss immer manuell überprüft werden.
- Es wird kein Foto an Supabase gesendet. Die OCR-Verarbeitung erfolgt im Browser; für die erstmaligen OCR-Ressourcen sind externe Downloads nötig.

## Installation
- Kein zusätzliches Supabase-SQL notwendig.
- GitHub Actions installiert `tesseract.js` beim Build mit `npm install`.
- **Lokaler Build in dieser Umgebung nicht möglich**, da npm registry DNS nicht erreichbar ist; GitHub Actions muss den Build prüfen.
