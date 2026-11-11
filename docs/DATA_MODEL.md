# Modello dati e contratti

Specifica logica tradotta nei tipi e negli schemi runtime in `src/domain/types.ts`. Il repository IndexedDB è in `src/infrastructure/db/repository.ts`; le porte implementate sono in `src/application/ports.ts`. Alcune entità sono già predisposte ma attendono i rispettivi comandi e schermate: consultare [HANDOFF.md](HANDOFF.md).

## Primitive

- `Id`: UUID generato localmente.
- `MoneyCents`: intero sicuro con validazione runtime; segno consentito soltanto dove previsto.
- `LocalDate`: stringa valida `YYYY-MM-DD`, verificata anche rispetto ai giorni del mese.
- `MonthKey`: `YYYY-MM`.
- `Instant`: timestamp ISO UTC per metadati tecnici.
- Record modificabili: `id`, `createdAt`, `updatedAt`, `revision`.

## Entità persistite

### Settings

Record singleton: versione dati, locale `it-IT`, valuta `EUR`, data iniziale, onboarding completato, ID della ricorrenza principale facoltativo, mese iniziale del piano, ultimo export riuscito. Saldo iniziale conservato come operazione, non duplicato nelle impostazioni.

### Envelope

`id`, nome, tipo `spending | saving | goal`, token colore, ordine, stato archiviato. Nessun campo saldo modificabile. Una storia di politiche contiene `envelopeId`, `effectiveMonth`, `rollover: carry | release-positive`. Modificare una politica crea o aggiorna soltanto la versione del mese corrente; archiviare non elimina movimenti storici ed è consentito solo a saldo zero e senza riferimenti attivi.

### Operation

Registro normalizzato. Ogni record contiene:

- ID, `commandId`, `effectiveDate`, sequenza stabile per parità di data, revisione.
- Tipo `opening | income | expense | refund | allocation | transfer | release`.
- Descrizione, note facoltative e origine `manual | recurring | plan | onboarding`.
- `cashDeltaCents`, `unassignedDeltaCents`, `envelopeDeltas[]` con ID busta e delta intero.
- Riferimento facoltativo a occorrenza, applicazione piano, spesa rimborsata o obiettivo acquistato.

Per ogni record: `cashDeltaCents = unassignedDeltaCents + sum(envelopeDeltas.deltaCents)`. Tipo e struttura dei delta devono corrispondere agli effetti descritti in FINANCIAL_RULES.md. Nessun array con buste ripetute; nessun riferimento inesistente.

Una copertura con due sorgenti e la spesa sono più operazioni nello stesso `commandId`. La proiezione non legge mai un gruppo a metà commit. `release` rappresenta una restituzione manuale ai soldi liberi; il rollover automatico è derivato e non occupa righe del registro.

Un rimborso è un’operazione `refund` collegata tramite `refundOf` alla spesa originale e accredita la stessa busta. La somma dei rimborsi non può superare la spesa. Correzione ed eliminazione del rimborso conservano la versione precedente in `history`.

Saldi correnti e storici, progresso degli obiettivi e totali mensili sono proiezioni. Non persistire queste somme come fonte di verità. Se si aggiungono cache, devono essere scartabili e ricostruibili.

### BudgetTemplateVersion

ID, mese di validità, quote `{ envelopeId, amountCents }` non negative e senza duplicati. Le versioni successive non riscrivono le precedenti.

### MonthlyPlan

Chiave univoca `MonthKey`. Versione del template, quote effettive del mese, stato `pending | needs-review | applied`, trigger/occorrenza di origine, data di applicazione e riferimenti alle operazioni. Revisioni successive conservano quanto già applicato e registrano il delta esplicito.

### Recurrence e RecurrenceVersion

Identità stabile della regola e versioni datate con descrizione, tipo entrata/uscita, importo positivo, frequenza mensile/annuale, data ancora, inizio/fine di validità e busta obbligatoria per uscite. Una sola ricorrenza principale attiva. Una modifica della regola non cambia il suo ID.

### Occurrence

Chiave univoca `{ ruleId, scheduledDate }`; versione della regola usata, stato `posted | skipped`, riferimento al movimento e metadati di eventuale correzione. Conservare anche le occorrenze eliminate intenzionalmente. Correggere data effettiva del movimento non cambia `scheduledDate`.

### Goal

ID, titolo, prezzo positivo, ID busta dedicata univoco tra obiettivi attivi, quota mensile prevista, data desiderata facoltativa, giorno mensile di accantonamento facoltativo (obbligatorio per simulare senza ricorrenza principale), stato `active | paused | purchased | archived`, riferimento all'eventuale operazione d'acquisto. Data stimata e progresso non sono campi persistiti. L’acquisto usa soltanto la disponibilità della busta dedicata, registra un’uscita collegata e lascia l’eventuale residuo nella busta.

### CommandReceipt e OperationHistory

Ricevuta con `commandId` univoco e risultato sintetico per retry idempotenti. Storico delle revisioni delle operazioni per spiegare correzioni ed eliminazioni; soltanto il registro attuale contribuisce ai saldi. Non è richiesta un'infrastruttura generale di event sourcing.

## Store IndexedDB

Database con nome specifico `esnupi`; versione schema separata dalla versione dell'app. Store per le entità sopra, con indici su data movimento, busta interessata se utile alle query, mese del piano e chiave occorrenza. È accettabile iniziare leggendo in memoria il piccolo registro completo per proiezioni; misurare prima di aggiungere snapshot incrementali.

I namespace riducono collisioni accidentali con altri progetti dello stesso dominio GitHub Pages; non isolano dati da altri script dello stesso origin. Vedi DEPLOYMENT.md.

## Porte applicative di riferimento

- `loadSnapshot()`: record necessari alle query, senza riferimenti mutabili allo storage.
- `runCommand(command, commandId, today)`: successo con dati aggiornati oppure errore tipizzato; commit atomico, riutilizzando ricevuta se il comando è già applicato.
- `getMonthView(snapshot, month, today)`: saldi, entrate, uscite, buste, piano e richieste di attenzione.
- `reconcileThrough(today)`: recupero deterministico, riepilogo e punto di ripresa.
- `simulateGoal(input, schedule, today)`: quota/data, assunzioni e incompatibilità.
- `exportBackup()` e `inspectBackup(file)`: creazione e validazione senza alterare l'archivio.
- `restoreBackup(validatedBackup)`: sostituzione completa atomica dopo scelta esplicita nell'interfaccia.
- `reset()`: svuotamento atomico di tutti gli store dopo conferma esplicita nell'interfaccia.

I comandi includono setup, registrazione/correzione/eliminazione movimento, copertura e spesa, trasferimento, modifica busta/politica, revisione/applicazione piano, modifica ricorrenza, copertura deficit e acquisto obiettivo. Form UI non dipendenti dagli store IndexedDB.

`Repository.runCommand(command, context)` riceve un contesto esplicito con `commandId`, `today`, `now` e generatore ID. `loadSnapshot()`, `restoreBackup(snapshot)` e `reset()` sono implementati; export e inspect sono funzioni pure del modulo backup. `monthView`, `simulateGoal` e `dueDates` sono funzioni pure del dominio. Correzione ed eliminazione sono collegate per i movimenti manuali e conservano in `history` tutte le operazioni del comando originale, comprese le coperture. `reconcileThrough` registra cronologicamente le occorrenze fino a oggi, applica il piano dopo l’entrata principale e resta idempotente tramite occorrenze uniche e transazione IndexedDB. Le modifiche future creano una nuova `RecurrenceVersion`; riattivare aggiunge una versione e cancellare una singola registrazione lascia l’occorrenza `skipped`. La correzione preserva l’occorrenza e non riscrive il piano già applicato. Il comando è una discriminated union: estenderla nel punto condiviso, senza aggiungere scritture dirette ai form.

## Proiezione cronologica

Ordinare operazioni per data effettiva e sequenza stabile. A ogni confine di mese applicare politiche valide per il mese concluso, rilasciando soltanto saldi positivi delle buste interessate. Esporre saldo pre-rilascio nel mese concluso e saldo post-rilascio nel nuovo mese.

Una correzione storica invalida le proiezioni dal mese interessato in avanti. Le assegnazioni reali del piano rimangono operazioni già eseguite; un eventuale nuovo deficit viene mostrato, non corretto inventando trasferimenti.

## Backup

Documento JSON con `format: esnupi-backup`, `schemaVersion`, `appVersion`, `exportedAt`, impostazioni e collezioni finanziarie, incluse versioni, ricevute e occorrenze saltate. Istantanee dei saldi eventualmente incluse sono solo diagnostiche e non sostituiscono il registro.

Controlli prima dell'importazione: dimensione entro limite dichiarato, JSON valido, versione supportata, primitive, importi sicuri, ID univoci, integrità dei riferimenti, invariante di ogni operazione e stato delle occorrenze. Versione futura non supportata → errore chiaro senza modifiche al DB.

Mostrare riepilogo e invitare a esportare l'archivio esistente prima della sostituzione. Mai cancellare l'archivio corrente durante la sola lettura/validazione. Preferire singola transazione di sostituzione; se si usa staging, definire prima recupero e rollback. Migrazioni testate con fixture di vecchie versioni.
