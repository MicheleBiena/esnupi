# Scenari di accettazione

Piano di verifica del prodotto completo. La base attuale ha superato 65 test unitari/di integrazione e 9 percorsi E2E sulla build statica; copertura e limiti nel documento [HANDOFF.md](HANDOFF.md). Gli scenari finanziari sono necessari perché errori di conteggio altererebbero disponibilità e previsioni.

## A01 — Setup e invariante

Saldo iniziale 800 €. Assegnare 300 € a Spese, 200 € a Risparmi e 100 € a Obiettivo. Atteso: `C=800`, `U=200`, somma buste 600. Ricaricare conserva tutti i dati. Annullare onboarding prima del commit non crea un archivio finanziario parziale.

## A02 — Risparmio virtuale

Spostare 50 € da soldi liberi a Risparmi. Saldo totale resta 800 €; nessuna uscita nel diario delle spese. Non contare la quota prevista dell'obiettivo come un secondo accantonamento.

## A03 — Copertura manuale

Spese contiene 30 €, Svago 40 €, soldi liberi 0 €. Registrare spesa 50 € da Spese. Prima del commit scegliere 20 € da Svago. Dopo: Spese 0 €, Svago 20 €, totale ridotto di 50 €. Annullando dialog, nessuna delle operazioni viene salvata. Retry del medesimo comando non addebita due volte.

## A04 — Scoperto reale

Saldo totale 25 € interamente nella busta Spese. Registrare spesa reale 40 €. Consentito: `C=-15`, Spese -15 €, avviso esplicito; nessun saldo azzerato artificialmente. Una successiva entrata non copre automaticamente la busta negativa: la destinazione del denaro resta esplicita.

## A05 — Rollover

Al 31 gennaio: Spese +45 € con `release-positive`, Risparmi +120 € con `carry`, Abbonamenti -8 €. A febbraio Spese 0 €, `U` aumenta di 45 €, Risparmi resta 120 €, Abbonamenti resta -8 €. `C` invariato. Gennaio mostra avanzo Spese prima del rilascio. Ripetere apertura non rilascia due volte.

## A06 — Piano automatico e insufficienza

Entrata principale 800 €, quote complessive 650 €: applicare una volta e lasciare 150 € liberi. Seconda apertura non duplica quote. In altro mese entrata 500 € con quote 650 €: nessuna assegnazione, stato `needs-review`. Nuova entrata non applica silenziosamente il piano; revisione e conferma a quote 450 € lasciano resto corretto. Cambiare template non ripete un piano applicato.

## A07 — Ricorrenze

Mensile con ancora 31 gennaio: 28 febbraio e 31 marzo nell'anno non bisestile. Annuale 29 febbraio: 28 nell'anno non bisestile e 29 al successivo bisestile. Riapertura dopo tre mesi recupera ogni scadenza dovuta una volta, nel mese corretto. Nessuna scadenza precedente all'inizio archivio o successiva a oggi. Verificare pausa, fine e cambio importo con validità futura.

## A08 — Addebito senza copertura

Busta Abbonamenti 5 €, ricorrenza 12 €, altri fondi disponibili. Registrare automaticamente: busta -7 €, saldo totale ridotto di 12 €, richiesta di copertura 7 €. Nessun trasferimento da altre buste finché l'utente non sceglie. Distinguere questo flusso dalla copertura obbligatoria della spesa manuale.

## A09 — Obiettivo e doppio conteggio

Prezzo 680 €, busta già a 200 €, quota 80 €: servono sei quote. Se quote future cadono dal 5 gennaio al 5 giugno, data stimata 5 giugno. Con tre quote disponibili entro scadenza, quota necessaria 160 €. Sei quote già finanziate non vengono contate nuovamente. Simulare non modifica saldi; comprare registra una sola spesa.

## A10 — Casi limite del simulatore

Prezzo già raggiunto, quota zero, nessuna quota entro scadenza, data nel passato, quota mensile in attesa e quote concorrenti oltre budget. Senza ricorrenza principale, chiedere giorno di accantonamento e non generare entrate implicite. Messaggi distinguibili, nessuna data inventata. Arrotondamenti verso l'alto al centesimo per quota richiesta. Ogni busta attiva finanzia al massimo un obiettivo.

## A11 — Idempotenza e interruzioni

Due tab riconciliano la stessa scadenza: un solo movimento. Interrompere fra scrittura occorrenza e movimento non lascia uno stato intermedio persistito. Eliminare volontariamente una ricorrenza già registrata e riaprire: non ricompare. Correggerla mantiene identificatore dell'occorrenza.

## A12 — Backup e recupero

Export → nuovo archivio → import produce stessi record finanziari, versioni e saldi derivati. JSON corrotto, versione futura, riferimenti mancanti o importi non sicuri non cambiano archivio corrente. Errore di commit non mostra successo. Ripristino ripetuto non aggiunge copie perché sostituisce archivio, non lo unisce.

Il reset richiede la parola `ELIMINA`, svuota tutte le collezioni in un solo commit e riporta all’onboarding anche dopo ricarica. Annullare o scrivere una conferma diversa non modifica alcun dato.

## A13 — Correzione storica

Al 31 gennaio busta con rilascio +100 €. Inserire poi spesa datata gennaio di 20 €: rilascio derivato diventa 80 €, saldi di febbraio si aggiornano senza lasciare 100 € liberi fittizi. Cambiare politica da marzo non modifica gennaio/febbraio. Revisionare entrata già assegnata non riscrive automaticamente le allocazioni eseguite.

## A14 — Parsing, invarianti e rimborsi

«12,50» = 1250 centesimi. Rifiutare numeri non finiti, fuori range, precisione aggiuntiva e date impossibili. Con sequenze di entrate, assegnazioni, uscite, trasferimenti e rimborsi verificare `C = U + somma(E)` a ogni passaggio e mese. Rimborso nella busta originaria non appare come nuova entrata ordinaria. Doppio rimborso oltre importo residuo richiede correzione esplicita, non passa come rimborso valido.

## A15 — UI e accessibilità

Percorso completo con tastiera: setup, aggiunta spesa, copertura, simulatore ed export. Focus visibile, etichette, errori vicino ai campi, dialog senza trappole, valori negativi comprensibili senza colore. Verificare zoom 200%, reduced motion e layout 375/768/1440px; nessun contenuto essenziale nascosto o scroll orizzontale della pagina. Contrasto testo normale almeno 4.5:1.

## A16 — Build GitHub Pages

Build pulita e typecheck. Servire artefatto sotto `/esnupi/`: asset presenti, nessuna richiesta involontaria alla radice, route hash apribile direttamente e refresh funzionante. Ricarica della build aggiornata conserva archivio locale. Nessuna chiamata remota per dati finanziari, font, immagini o analytics.

## Livelli e limiti

Unit test sul dominio, integrazione su IndexedDB e backup, pochi E2E su scenari completi. Le prove di atomicità, calendario, retroattività e idempotenza non devono essere sostituite da soli screenshot. Browser desktop collaudato: Chromium aggiornato. La prima versione non dichiara compatibilità specifica con browser non collaudati. Compatibilità telefono di base sul layout, senza promessa di sincronizzazione.
