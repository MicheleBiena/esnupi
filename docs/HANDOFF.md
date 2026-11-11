# Passaggio di consegne — prima base

Aggiornato l'11 novembre 2026. Leggere questo file prima di scegliere un incarico nel piano originale. Nessun sottoagente è stato avviato: questa base è stata sviluppata direttamente per consentire incarichi successivi più circoscritti.

## Note editoriali da mantenere

- Destinatario al maschile; se serve rivolgersi direttamente a lui, «tato». Nessuna forma femminile riferita a lui.
- Niente slogan, frasi motivazionali, motti o metafore. Rimossi banner, motto sotto il logo, frasi laterali e footer; testi limitati a funzioni, stati e azioni.
- Grafiche definitive a carico del committente. L'illustrazione provvisoria è rimossa; resta un placeholder CSS neutro nell'onboarding. Non generare o procurare asset nei task successivi.
- Termini coerenti: «Obiettivi», «Impostazioni», «Backup dei dati». Nuova busta predefinita «Svago» soltanto per nuovi archivi; nessuna riscrittura dei dati esistenti.

## Funziona adesso

- React + TypeScript strict + Vite, lockfile, Node 24 LTS di riferimento, base `/esnupi/`, routing hash e navigazione con focus.
- Onboarding con saldo e data iniziale; quattro buste iniziali e archivio vuoto reale, senza dati demo caricati automaticamente.
- Registrazione di entrate e uscite; controllo date, importi in centesimi e saldi derivati.
- Copertura manuale delle spese tramite sorgenti scelte; trasferimenti e spesa nello stesso commit. Scoperto reale rappresentabile.
- Creazione di nuove buste con politica di riporto; spostamenti tra buste e denaro da assegnare.
- Modifica del nome e della politica di riporto a partire dal mese corrente. Una busta si può archiviare soltanto a saldo zero e senza riferimenti attivi in obiettivi, ricorrenze o piani futuri; i movimenti passati restano consultabili.
- Riepilogo per mese, diario delle entrate/uscite, disponibilità delle buste e richieste di copertura.
- Obiettivi con busta dedicata e simulazione quota → data e data → quota. Simulare non modifica disponibilità.
- Acquisto di un obiettivo come uscita reale dalla busta dedicata. L’obiettivo passa ad acquistato, il movimento resta collegato e l’eventuale residuo non viene spostato automaticamente.
- Riepilogo delle quote di tutti gli obiettivi attivi rispetto a entrata principale e piano mensile. Le quote già presenti nel piano non vengono contate due volte; differenze e quote non incluse sono soltanto segnalate.
- IndexedDB con store per collezione, ricevute idempotenti e transazioni serializzate tra tab. BroadcastChannel aggiorna le altre tab dopo commit.
- Export JSON completo, limite 10 MB, validazione runtime e ripristino completo con conferma. File invalido non altera l'archivio.
- Data e ora dell’ultimo download avviato persistite nelle Impostazioni e incluse nel backup esportato. Non viene presentata come prova che il file sia stato conservato.
- Reset completo dalle Impostazioni con conferma digitata; tutti gli store IndexedDB vengono svuotati in una sola transazione e l’app torna all’onboarding.
- Modifica ed eliminazione di entrate e uscite manuali dal diario. Una spesa corretta sostituisce atomicamente anche le coperture collegate; le versioni precedenti restano in `history`.
- Rimborsi parziali o totali collegati alla spesa e alla sua busta, correggibili ed eliminabili con storico. Il diario filtra per testo, tipo, automatici e busta senza alterare i dati.
- Ricorrenze mensili e annuali per entrate e uscite, entrata principale facoltativa, recupero cronologico fino a oggi, modifica futura versionata, disattivazione e riattivazione. Le registrazioni automatiche si possono correggere mantenendo la stessa occorrenza oppure eliminare lasciandola `skipped`.
- Piano mensile per busta, versionato dal mese scelto. Si applica una volta dopo l’entrata principale; se i fondi non bastano resta `needs-review` senza assegnazioni parziali e richiede conferma manuale.
- Revisione esplicita di un piano applicato: registra soltanto aumenti e restituzioni rispetto alle quote correnti. Una riduzione viene bloccata se la relativa disponibilità è già stata spesa.
- Token visivi, layout desktop/adattabile, dialog nativi, placeholder CSS e icone funzionali locali. Nessuna richiesta a CDN o API finanziarie.

## File che definiscono i contratti

- `src/domain/types.ts`: schemi Zod e tipi inferiti, record finanziari e snapshot.
- `src/application/ports.ts`: comandi disponibili, repository e clock.
- `src/application/commands/runCommand.ts`: trasformazione pura di snapshot, ricevute e validazione finale.
- `src/domain/ledger.ts`: proiezione cronologica e rollover derivato, da non duplicare nella UI.
- `src/domain/budget.ts`: copertura, trasferimenti e finanziamento atomico di un draft di piano.
- `src/domain/validation.ts`: integrità tra collezioni e validazione dei dati non attendibili.

Gli helper mutanti di budget lavorano soltanto su un draft: è `runCommand` che clona l'input e il repository che garantisce commit/rollback. Non usarli per modificare lo snapshot React direttamente.

## Verifiche effettive

- **65 test** Vitest superati: parsing e overflow, calendario/bisestili, invariante, rollover e rettifiche storiche, sforamenti, piano insufficiente, applicazione unica e revisione per differenza, rimborsi, simulazioni singole e complessive, modifica/archiviazione buste, acquisto obiettivo, revisione del diario, riconciliazione, versioni future, scadenze saltate, riattivazione, concorrenza IndexedDB, idempotenza, backup, data export e reset.
- **9 E2E** Playwright superati su build di produzione con Chrome: percorsi precedenti, confronto complessivo piano/entrata/obiettivi, persistenza della data export, navigazione da tastiera, chiusura dialog, ripristino focus e reflow equivalente a zoom 200%.
- Typecheck e build riusciti. Asset e routing serviti sotto `/esnupi/`; nel percorso E2E non risultano richieste a servizi esterni.
- Screenshot desktop e telefono ispezionati. Le immagini dei test sono in `test-results/`, cartella ignorata.
- Installazione finale dipendenze: audit npm senza vulnerabilità segnalate. Vitest aggiornato alla versione 5 per non conservare dipendenze vulnerabili individuate nel primo bootstrap.

Queste prove non equivalgono a un collaudo su ogni browser o alla CI remota. Non esiste ancora uno schema dati precedente o successivo con cui provare una migrazione reale; nessuna migrazione fittizia è stata aggiunta.

## Stato rispetto al piano

- **T0 completato.** Non ripetere bootstrap o cambiare stack.
- **T1 completato per la prima versione.** Calendario, registro, copertura, rimborsi, finanziamento e revisione per differenza del piano, simulazioni singole e confronto complessivo col reddito sono testati.
- **T2 completato per lo schema attuale.** Store, transazioni, validazione, backup, data ultimo export, reset, rimborsi e revisione dei movimenti manuali/automatici con storico sono reali. Una migrazione si aggiungerà insieme a un futuro schema v2.
- **T3 completato per la prima versione.** Riconciliazione all’apertura/ritorno in primo piano/cambio giorno, ordine entrate → piano → uscite, recupero, occorrenze uniche, concorrenza tra tab, versioni future, riattivazione, correzione ed eliminazione come `skipped` sono testati.
- **T4 base funzionale implementata.** I percorsi principali usano dati reali: ricorrenze, piano, rimborsi, filtri, modifica/archiviazione buste e acquisto obiettivi. Restano simulazione complessiva delle quote, collaudo accessibilità esteso e grafiche definitive del committente.
- **T5 preparato localmente.** CI e workflow Pages scritti con action fissate a commit, build e collaudo locale eseguiti. GitHub remoto, esecuzione CI remota e pubblicazione restano esterni a questo checkout.

## Prossimi incarichi circoscritti

### 1. Grafiche definitive

Inserire soltanto i file forniti dal committente nelle aree placeholder già previste. Non generare, cercare o ampliare illustrazioni.

### 2. Pubblicazione

Configurare remoto e Pages quando owner/repository saranno noti, eseguire i workflow su GitHub e aprire l’URL finale. Verificare eventualmente Firefox e Safari prima di prometterne la compatibilità. Non aggiungere motti, banner o fixture grafici.

## Ambiente di sviluppo attuale

Il PC espone Node 23.4.0; per eseguire il tooling aggiornato è stato installato **Node 24.22.2 soltanto in `.tools/`**, senza toccare il sistema. La cartella è ignorata e non è una dipendenza runtime dell'app.

Avvio pratico in questo workspace: `powershell -File scripts/dev.ps1`. In un checkout normale usare Node 24 LTS, `npm ci` e gli script di package.json. Il problema sandbox di risoluzione del percorso npm di sistema è stato aggirato chiamando il CLI npm con `--preserve-symlinks --preserve-symlinks-main`; non è una modifica richiesta al prodotto.

Per le verifiche qui sono stati eseguiti i CLI TypeScript, Vitest, Vite e Playwright con il runtime locale. I server temporanei dei test vengono arrestati automaticamente. Nessun servizio deve restare attivo per proseguire lo sviluppo.
