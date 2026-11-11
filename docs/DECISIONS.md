# Registro decisioni

Data di riferimento: 11 novembre 2026. Le ultime risposte del committente prevalgono sulle precedenti.

## Confermato nella raccolta requisiti

- Nome: **esnupi**. Cartella di lavoro: quella corrente. Hosting: GitHub Pages.
- Destinatario appassionato di Snoopy; è un amico del committente e usa il maschile.
- Budget a buste: categorie di spesa, risparmi e obiettivi.
- Riferimento visivo: fumetto Peanuts. La precedente scelta «diario pastello» è stata ritirata; gestione delle grafiche e testi precisata nelle note editoriali sotto.
- Palette: carta crema, nero, rosso cuccia, giallo Woodstock.
- Dopo una prima richiesta di sincronizzazione: «Nah facciamo solo pc dai».
- Offline non necessario; è stata anche selezionata l'opzione browser su telefono e PC.
- Mesi solari, dal primo all'ultimo giorno.
- Saldo unico, ripartibile tra buste; nessuna distinzione conti/contanti.
- Ogni busta sceglie se accumulare o restituire avanzo ai soldi da assegnare.
- Entrate ricorrenti e abbonamenti registrati automaticamente, poi correggibili.
- Piano mensile automatico modificabile; eccedenza resta da assegnare.
- Piano non finanziabile: nessuna assegnazione parziale automatica; revisione e conferma manuale.
- Obiettivi: quota mensile → data stimata e data desiderata → quota necessaria.
- Sforamento manuale: scegliere prima da quale altra busta coprire la differenza.
- Spesa reale superiore al saldo totale: registrare comunque, con saldo negativo e scoperto espliciti.
- Ricorrenza automatica con busta insufficiente: registrare, segnalare deficit, chiedere copertura alla riapertura.

## Interpretazione comunicata

«Solo PC» sostituisce il requisito di sincronizzazione. Prima versione locale nel browser del PC, senza account o backend; layout adattabile al telefono. Il requisito responsive non implica dati condivisi. Nessuna ulteriore obiezione è stata ricevuta a questa interpretazione.

## Note editoriali successive — vincolanti

- Grafiche soltanto placeholder: le immagini definitive saranno inserite dal committente. Nessuna generazione o selezione di asset da parte degli agenti.
- Rimossi banner, motto sotto il logo, frasi laterali, footer motivazionale e testi promozionali. Il logo basta; aggiungere soltanto spiegazioni semplici delle funzioni.
- Niente frasi motivazionali, slogan, motti o metafore su sogni, piccoli passi e cose belle.
- Il destinatario è un uomo. Usare il maschile; quando serve un appellativo diretto, «tato». Evitare forme femminili riferite a lui.
- Etichette funzionali: «Obiettivi», «Impostazioni», «Backup dei dati». Le buste predefinite dei nuovi archivi includono «Svago»; nomi e dati già salvati restano invariati.

Queste istruzioni sostituiscono le precedenti indicazioni su illustrazioni e tono giocoso dei testi.

## Scelte architetturali per partire

- React + TypeScript + Vite per una SPA statica. Hash routing per accesso diretto alle schermate su GitHub Pages.
- IndexedDB come archivio finanziario, con wrapper idb e transazioni. localStorage riservato a preferenze non critiche.
- Registro di operazioni come fonte dei saldi; rollover dei mesi derivato in modo deterministico.
- Piano in quote fisse per busta; un'applicazione per mese, innescata dall'entrata principale. Il setup può inizializzare esplicitamente il mese corrente.
- Ricorrenze mensili/annuali nella prima versione; altre frequenze potranno essere aggiunte senza cambiare il significato del saldo.
- Backup JSON versionato e ripristino completo. Unione tra archivi e sincronizzazione non incluse.
- Tema chiaro nella prima versione. Dark mode non richiesto.
- Lingua italiana, EUR e importi in centesimi. Nessun dato o servizio fiscale collegato all'entrata.
- Font, icone e immagini serviti dal sito. Nessun analytics.

Queste scelte risolvono dettagli lasciati aperti usando il minimo necessario al prodotto. Non richiedono un nuovo giro di approvazione per il normale sviluppo.

## Dettagli operativi

- Repository remoto: `https://github.com/MicheleBiena/esnupi.git`. URL pubblico: `https://michelebiena.github.io/esnupi/`.
- Grafiche definitive: saranno inserite dal committente; gli agenti mantengono soltanto i placeholder.
- Importi, data iniziale e ricorrenze: dati del destinatario. La prima base propone quattro buste iniziali; non trasformare nomi o dati di archivi esistenti durante modifiche editoriali.
- Versioni delle dipendenze e Node: fissate e verificate nel lockfile e nei workflow.

Non restano domande bloccanti sulla direzione del prodotto. Eventuali nuovi comportamenti vanno registrati qui, distinguendo richiesta dell'utente e scelta implementativa.
