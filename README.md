# AntwortProfi

Web-Tool für lokale Betriebe (Cafés, Friseure, Praxen, Handwerker): Google-Bewertung einfügen,
Ton wählen, und Claude schreibt drei professionelle Antworten zum Kopieren.

## Starten

```bash
npm install
cp .env.example .env          # API-Key eintragen
node --env-file=.env server.ts
# → http://localhost:3000
```

Node 22.18 oder neuer (führt TypeScript direkt aus).

| Variable | Bedeutung |
|---|---|
| `ANTHROPIC_API_KEY` | Claude-API-Key (Pflicht) |
| `ACCESS_CODES` | Kommagetrennte Zugangscodes zahlender Kunden. Leer = offen. |
| `CLAUDE_MODEL` | Standard `claude-haiku-5-5` (Bruchteile eines Cents pro Anfrage). Mehr Qualität: `claude-opus-5-5`. |
| `MAX_PER_HOUR` | Anfragen pro IP und Stunde (Standard 30) |
| `PORT` | Standard 3000 |

## Prüfen

```bash
npm run typecheck
npm test
```

## Geschäftsmodell

1. **Online stellen** (z. B. Render, Railway, Fly.io), mit eigenem API-Key.
2. **Verkaufen:** Monatsabo, z. B. 19–29 €/Monat pro Betrieb, über einen Stripe- oder
   Gumroad-Zahlungslink. Nach der Zahlung bekommt der Kunde einen Zugangscode (`ACCESS_CODES`).
3. **Kosten pro Antwort:** wenige Cent (abhängig vom Modell). Bei normaler Nutzung bleibt
   ein großer Teil des Abopreises als Marge.
4. **Akquise:** Betriebe mit vielen unbeantworteten Google-Bewertungen direkt ansprechen
   und ihnen 3 Antworten gratis als Probe schicken.

## Online stellen

Render (render.com): **New → Blueprint** → dieses Repo wählen. `render.yaml` richtet alles ein.
Im Dashboard noch `ANTHROPIC_API_KEY` und `ACCESS_CODES` eintragen.
(Der Gratis-Plan schläft nach Inaktivität ein; die erste Anfrage dauert dann ~1 Minute.)

Verkaufsplan, Preise und Nachrichtenvorlagen: [docs/verkauf.md](docs/verkauf.md)
