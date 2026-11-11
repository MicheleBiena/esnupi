# Piano di implementazione per sottoagenti

## Stato di partenza

Il piano originale seguente documenta le responsabilità usate per costruire il progetto. T0–T5 sono completati per la prima versione e il sito è pubblicato. Prima di assumere un incarico leggere [HANDOFF.md](HANDOFF.md): l’unico lavoro pianificato ancora aperto è inserire gli asset definitivi forniti dal committente.

Le responsabilità consentono futura delega esplicita. Non richiedono che tutti gli agenti vengano avviati insieme. Un coordinatore custodisce contratti condivisi e integrazione; evitare modifiche concorrenti agli stessi file.

## T0 — Fondazione e contratti

Dipendenze: nessuna. Proprietà: root config, `src/app`, `src/domain/types.ts`, `src/application/ports.ts`, `src/styles` di base, lockfile.

Creare React + TypeScript strict + Vite nella cartella corrente senza sovrascrivere docs. Fissare dipendenze e Node compatibili, script `dev`, `build`, `preview`, `typecheck`, `test`, `test:e2e`. Configurare hash routing, base Pages e struttura prevista. Definire i tipi del modello dati, errori e porte applicative con chi continua dominio e persistenza.

Uscita verificabile: build statica, shell di navigazione da tastiera, route con refresh funzionante sotto `/esnupi/`, contratti condivisi compilabili e fixture sintetico. Congelare questi contratti prima dei task dipendenti.

## T1 — Dominio finanziario

Dipende da T0. Proprietà: `src/domain` escluso contratto condiviso senza coordinamento; test unitari relativi.

Realizzare aritmetica, calendario, costruttori di operazioni, proiezione cronologica, rollover, copertura, piano e simulatore. Gestire deficit reali, ricorrenze senza fondi, revisioni retroattive e assenza di quote future. Tutte le funzioni ricevono esplicitamente la data corrente.

Uscita: scenari A01–A10, A13 e A14 del documento ACCEPTANCE coperti al livello pertinente; invariante verificata dopo ogni comando e mese derivato. Nessuna dipendenza da React o browser.

## T2 — Persistenza, backup e comandi

Dipende da T0; integrazione finale con T1. Proprietà: `src/infrastructure`, `src/application/commands`, fixture storage e backup.

Implementare IndexedDB, migrazioni, transazioni, revisioni, ricevute idempotenti e validazione import/export. Collegare comandi al dominio: nessuna regola monetaria duplicata nel repository. Gestire errori di apertura, quota e commit senza conferme false.

Uscita: persistenza dopo reload, transazioni indivisibili, importazione non distruttiva se invalida, backup completo e prova di migrazione. Fixture e snapshot seguono schema reale.

## T3 — Ricorrenze e coordinamento mensile

Dipende da T1 e T2. Proprietà: `src/application/reconcile.ts`, query mensili e relativi test; modifiche ai tipi solo concordate.

Recupero cronologico, chiavi stabili, date corte/bisestili, entrata principale e piano una volta per mese, stato di revisione se fondi insufficienti, occorrenze saltate, ripresa dopo interruzione e due tab. Riconciliare all'apertura e al cambio giorno, senza backend o service worker.

Uscita: scenari A05–A07 e A11 passano su storage reale; riepilogo delle registrazioni generate disponibile alla UI.

## T4 — UI, asset e percorsi di prodotto

Dipende da shell e contratti T0; può preparare componenti con fixture mentre T1–T3 avanzano. Proprietà: `src/features`, `src/shared/ui`, CSS dei componenti, `public/assets` e inventario asset.

Implementare onboarding, mese, diario, buste, obiettivi, ricorrenze e backup con design-system/MASTER.md. UI chiama porte condivise. Realizzare prima percorso completo saldo → piano → spesa → copertura → reload, poi simulatore e configurazione ricorrenze.

Predisporre soltanto placeholder neutri; le grafiche definitive saranno inserite dal committente. Non generare o selezionare asset. Applicare le regole editoriali di AGENTS.md: testi funzionali, niente motti e riferimenti al destinatario al maschile. Preparare tutti gli stati: nessun dato, caricamento, errore, piano in attesa, deficit, importazione non valida e obiettivo raggiunto.

Uscita: nessun form centrale finto, numeri dal dominio, navigazione e copertura accessibili da tastiera, logo e placeholder neutri, dati utente conservati su errore.

## T5 — Integrazione e pubblicazione

Dipende da T1–T4. Proprietà: E2E, workflow GitHub Actions, eventuali correzioni concordate e docs operative.

Eseguire scenari integrati, build e controlli accessibilità; verificare asset e routing con base del repository. Preparare CI su pull request e deploy Pages su branch principale/manuale. Completare configurazione remota quando owner/repository sono noti e il task autorizza pubblicazione.

Uscita: scenari di accettazione documentati con esiti, nessun dato personale in artefatti, README aggiornato con comandi reali. Dichiarare esplicitamente limiti di verifica e stato di pubblicazione.

## Protocollo di consegna tra agenti

Ogni consegna indica file modificati, contratti cambiati, comportamento disponibile, verifiche effettive e lavoro ancora aperto. Non dichiarare completato T4 se manca T3 o se i dati sono ancora fixture.

Ogni divergenza dalle regole finanziarie si risolve nel dominio e nei documenti, poi viene recepita dagli adapter. Non applicare correzioni locali ai numeri mostrati soltanto per ottenere una schermata plausibile.
