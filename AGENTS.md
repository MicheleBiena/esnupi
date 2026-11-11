# Istruzioni per gli agenti di esnupi

## Obiettivo

Realizzare una webapp personale di budget a buste, su GitHub Pages, con dati locali nel browser del PC e identità Snoopy/Peanuts. La documentazione descrive la direzione raccolta con il committente; non trasformare dettagli tecnici proposti in nuove richieste di approvazione.

## Prima di lavorare

- Leggere README, docs/DECISIONS.md e i documenti rilevanti per il proprio incarico.
- Per il dominio: leggere integralmente FINANCIAL_RULES.md e DATA_MODEL.md.
- Per UI: leggere design-system/MASTER.md e gli eventuali override in design-system/pages/.
- Scegliere un incarico in IMPLEMENTATION_PLAN.md; comunicare file coinvolti e dipendenze.
- Riutilizzare il checkout corrente. Non sovrascrivere il lavoro di altri agenti.
- Non avviare automaticamente sottoagenti per la sola presenza di questo file. Il piano prepara incarichi per future sessioni autorizzate.

## Vincoli del prodotto

- Italiano, EUR, mesi solari, date civili locali.
- Un saldo complessivo. Le buste sono destinazioni virtuali dello stesso denaro.
- Nessun backend, login, sincronizzazione, collegamento bancario o dato finanziario nel repository.
- Nessun requisito PWA/offline nella prima versione.
- Ricorrenze automatiche riconciliate quando l'app è aperta; nessuna promessa di esecuzione a browser chiuso.
- Sforamento manuale: scegliere copertura prima della registrazione, salvo scoperto complessivo reale.
- Scoperto complessivo e ricorrenze senza copertura restano rappresentabili. Non nascondere valori negativi.
- Tono rispettoso: niente rimproveri, colpevolizzazione o notifiche punitive.

## Testi, pronomi e grafiche

Queste indicazioni editoriali del committente prevalgono sulla direzione iniziale:

- Il destinatario è un amico del committente e usa il maschile. Non usare il femminile per riferirsi a lui, nei testi dell'app o nei documenti.
- Preferire istruzioni neutre e brevi. Se serve rivolgersi direttamente a lui, usare «tato» oppure forme maschili; non inserire appellativi in ogni messaggio.
- Niente slogan, motti, frasi motivazionali, celebrazioni generiche o metafore su sogni, piccoli passi, viaggi e cose belle.
- Bastano il logo, nomi chiari delle sezioni e spiegazioni semplici di funzioni, stati ed errori. Non aggiungere testo soltanto per riempire uno spazio.
- Usare «obiettivo» per gli acquisti pianificati, «Impostazioni» per configurazione/backup e termini finanziari comuni.
- Le grafiche definitive saranno inserite dal committente. Predisporre soltanto placeholder neutri; non generare, disegnare, cercare o scaricare illustrazioni Snoopy e non ampliare le aree decorative.
- Le icone funzionali esistenti e il logo testuale possono restare. Non sostituire o rinominare dati già salvati per applicare una modifica editoriale.

## Regole tecniche

- Stack scelto per l'implementazione: React, TypeScript strict, Vite, CSS con token, IndexedDB tramite idb.
- Il riferimento React Native nella skill UI non cambia la richiesta esplicita di webapp su GitHub Pages: usare elementi HTML semantici.
- Dominio puro, separato da React, browser, storage e clock globale. Passare data corrente come input.
- Importi in centesimi interi sicuri; mai aritmetica finanziaria su float.
- Saldi derivati dal registro. Nessuna seconda fonte di verità in componenti o localStorage.
- Comandi finanziari atomici e idempotenti. La UI conferma salvataggio soltanto dopo commit.
- Validare backup e dati persistiti a runtime. Importazioni mai parziali.
- Non aggiungere librerie di grafici, store globale o UI kit finché un bisogno concreto non li giustifica.
- Bloccare versioni con lockfile al bootstrap; verificare compatibilità Node/tooling in quel momento.
- Nessun analytics o caricamento remoto di font/immagini nell'app. Asset serviti dal sito.
- Dopo modifiche al dominio aggiornare regole, esempi e verifiche interessate.

## Consegna

Riportare comportamento realizzato, verifiche eseguite e limiti effettivi. Non dichiarare completati task dipendenti da schermate vuote, dati finti o persistenza simulata. Se un caso già deciso sembra incoerente, riprodurre il problema e proporre una correzione circoscritta.
