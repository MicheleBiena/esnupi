# esnupi

Webapp personale per tracciare spese e risparmi, organizzare un budget a buste e pianificare acquisti. Riferimento visivo Peanuts: carta crema, inchiostro nero, rosso e giallo. Grafiche soltanto placeholder: le immagini definitive saranno inserite dal committente. Testi funzionali, senza motti o frasi motivazionali; destinatario al maschile, «tato» quando serve un appellativo.

## Stato

Progettazione e prima versione funzionale al **11 novembre 2026**. Applicazione React con onboarding, saldo e diario filtrabile, rimborsi collegati, buste modificabili e archiviabili, trasferimenti, copertura delle spese, obiettivi con simulazione singola e confronto complessivo col budget, acquisto reale, ricorrenze mensili/annuali versionate, piano mensile revisionabile, backup JSON con data dell’ultimo export e reset completo. I dati sono effettivamente salvati in IndexedDB. Le migrazioni verranno aggiunte quando esisterà uno schema successivo reale da migrare.

**Verifiche:** 65 test unitari/di integrazione, 9 test E2E su build statica, typecheck e build riusciti. Sito non pubblicato; repository remoto non configurato. La cartella iniziale era vuota e non era un repository Git.

Destinazione: GitHub Pages. Dati finanziari nel browser del PC, fuori dal repository. Nessun account o sincronizzazione nella prima versione. Layout adattabile al telefono; accesso da un altro browser o dispositivo significa archivio distinto. Offline e installazione come app non richiesti.

## Lettura per chi continua il progetto

1. [AGENTS.md](AGENTS.md): istruzioni operative e vincoli.
2. [Prodotto](docs/PRODUCT.md): bisogni, funzionalità e flussi.
3. [Decisioni](docs/DECISIONS.md): risposte confermate, interpretazioni e scelte tecniche.
4. [Architettura](docs/ARCHITECTURE.md): stack, moduli e confini.
5. [Regole finanziarie](docs/FINANCIAL_RULES.md): significato dei numeri e casi limite.
6. [Modello dati](docs/DATA_MODEL.md): entità, contratti e persistenza.
7. [Design system](design-system/MASTER.md): direzione visiva e accessibilità.
8. [Lavoro per sottoagenti](docs/IMPLEMENTATION_PLAN.md): dipendenze, consegne e responsabilità.
9. [Verifiche](docs/ACCEPTANCE.md): scenari di accettazione.
10. [Pubblicazione e dati](docs/DEPLOYMENT.md): GitHub Pages, backup e aggiornamenti.
11. [Passaggio di consegne attuale](docs/HANDOFF.md): stato effettivo, limiti e prossimi incarichi.

## Percorso iniziale

Non restano blocchi funzionali pianificati per la prima versione. I prossimi passaggi sono inserire le grafiche fornite dal committente e configurare il repository remoto per eseguire CI e deploy GitHub Pages. Leggere HANDOFF.md prima di intervenire: i limiti della verifica locale e della pubblicazione sono indicati lì.

Non usare dati personali nei fixture, nelle immagini o nelle demo. Gli importi della documentazione sono esempi inventati.

## Avvio

Richiesto Node **24 LTS** (oppure altra versione supportata da `engines`).

```sh
npm ci
npm run dev
```

Aprire `http://127.0.0.1:5173/esnupi/`. In questo workspace Windows è disponibile anche `powershell -File scripts/dev.ps1`, che usa il runtime Node 24 già predisposto in `.tools/` senza cambiare l'installazione di sistema. `.tools/` è ignorata da Git e non viene distribuita.

```sh
npm test
npm run typecheck
npm run build
npm run test:e2e
```

I test E2E costruiscono l'app e verificano il risultato tramite `vite preview` sulla porta 4173. Su Windows usano Chrome installato; su Linux Chromium di Playwright (`npx playwright install --with-deps chromium`). `npm run preview` serve la build locale, non è un server di produzione.

La CI esegue test e build su Node 24. Il workflow Pages è predisposto; per pubblicare occorre configurare il repository remoto e impostare GitHub Pages con sorgente GitHub Actions.
