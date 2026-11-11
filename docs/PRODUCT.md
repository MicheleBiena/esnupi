# Prodotto

## Bisogno

Il destinatario è un amico del committente e usa il maschile. Riceve un'entrata mensile, vuole usarne una parte senza consumare i risparmi e capire quando potrà permettersi acquisti importanti. Deve anche riconoscere le uscite ricorrenti e annotare entrate e spese quotidiane.

Le tre domande principali dell'app sono:

- Quanto denaro ho, e quanto è ancora libero da assegnare?
- Quanto posso spendere in questa busta senza intaccarne altre?
- Continuando a mettere da parte questa quota, quando raggiungo il mio obiettivo?

## Prima versione

- Configurazione iniziale: saldo alla data di partenza, buste e relativi saldi, entrata ricorrente facoltativa, piano mensile.
- Riepilogo mensile: saldo totale, soldi da assegnare, risparmi riservati, spese, prossime scadenze e problemi da risolvere.
- Diario: entrate e uscite, data, descrizione, busta per le uscite, note facoltative; modifica, eliminazione e filtri.
- Buste spesa, risparmio e obiettivo. Ogni busta sceglie se accumulare o restituire l'avanzo positivo a fine mese.
- Piano mensile a importi fissi, applicato automaticamente una volta nel mese quando arriva l'entrata principale. Modificabile per i mesi successivi e per il mese corrente con operazioni esplicite.
- Trasferimenti tra buste e soldi da assegnare.
- Ricorrenze per entrate e abbonamenti: mensili e annuali, importo, prossima scadenza, pausa/fine e correzione delle singole registrazioni.
- Obiettivi: prezzo, busta collegata, quota mensile prevista, data desiderata facoltativa; entrambe le direzioni di simulazione.
- Esportazione e ripristino JSON completi; promemoria discreto di backup e data dell'ultimo export.
- Cronologia consultabile dei mesi precedenti; riepiloghi essenziali e dati leggibili anche senza grafici.

## Navigazione

Sidebar desktop con cinque destinazioni: **Il mio mese**, **Movimenti**, **Buste**, **Obiettivi**, **Ricorrenze**. Impostazioni e backup in posizione secondaria stabile. Su schermi stretti adattare la stessa gerarchia con etichette visibili.

La prima schermata è l'app, non una landing commerciale. Azione primaria nel riepilogo: **Aggiungi movimento**. Problemi di copertura e piano in attesa compaiono accanto ai numeri interessati.

## Flussi principali

### Primo uso

Spiegare brevemente dove restano i dati e come esportarli. Inserire saldo e data di partenza, creare poche buste modificabili e distribuire saldo disponibile. Importare un backup è un'alternativa all'onboarding. Nessuna entrata precedente alla data di partenza viene generata implicitamente.

### Spesa manuale

Importo, descrizione, data e busta. Se la busta non basta ma il denaro esiste altrove, mostrare la differenza e chiedere quali buste/soldi liberi usare. Copertura e spesa vengono salvate insieme. Con saldo complessivo insufficiente, consentire comunque la registrazione reale e mostrare lo scoperto residuo.

### Apertura dopo più giorni o mesi

Riconciliare scadenze maturate senza duplicati. Mostrare un riepilogo delle registrazioni automatiche, delle buste da coprire e degli eventuali piani in attesa. Ogni addebito automatico è correggibile; non confonderlo con una verifica bancaria.

### Pianificare un acquisto

Creare un obiettivo con prezzo e busta dedicata. Impostare quota mensile per ottenere una data, oppure data per ottenere quota necessaria. Simulare non sposta soldi. Il piano può finanziare la busta una sola volta per quota prevista. Comprare l'oggetto genera un'uscita reale da quella busta.

## Fuori dalla prima versione

Sincronizzazione, più utenti, conti separati, investimenti, prestiti strutturati, riconciliazione bancaria, caricamento scontrini, notifiche push, account, crittografia/password interna e pubblicazione di bilanci condivisi.

## Voce

Italiano semplice e diretto. Niente frasi motivazionali, motti, slogan, metafore o riempitivi. Il logo è sufficiente per il marchio; i testi spiegano soltanto cosa fanno le voci, lo stato dei dati e le azioni disponibili.

Esempi: «Mancano 18 € nella busta Svago», «Scegli da dove coprire la differenza», «Piano da rivedere», «Nessun movimento nel mese selezionato». Nomi delle sezioni e dei pulsanti coerenti: «Obiettivi», «Nuovo obiettivo», «Impostazioni», «Backup dei dati».

Riferimenti al destinatario esclusivamente al maschile; se serve un appellativo, usare «tato», senza ripeterlo inutilmente. Nessuna battuta sulla sua capacità di gestire i soldi.

## Grafiche

Solo placeholder neutri. Le immagini definitive saranno inserite dal committente: gli agenti non devono produrre o selezionare illustrazioni. Nessun banner promozionale o area decorativa aggiunta per riempire la pagina. Il tema e le icone funzionali restano utilizzabili.
