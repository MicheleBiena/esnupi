# Regole finanziarie

Contratto del dominio. Tutti gli esempi sono sintetici. Le operazioni riguardano un registro personale, non certificano il saldo bancario effettivo.

## 1. Invariante centrale

Definire:

- `C`: saldo complessivo registrato, anche negativo.
- `U`: denaro da assegnare, anche negativo se una correzione retroattiva crea deficit.
- `E[i]`: disponibilità della busta i, anche negativa nei casi previsti.

Deve sempre valere `C = U + somma(E[i])`. Tutti i valori sono centesimi interi sicuri. Verificare anche che somme e prodotti intermedi rimangano rappresentabili.

Accantonare risparmi non è un'uscita: cambia la destinazione del denaro, non `C`. Una previsione non è un'entrata. Una quota mensile prevista non è un accantonamento già avvenuto.

## 2. Effetti delle operazioni

- Saldo iniziale +800 €: `C +800`, `U +800`. Distribuzione iniziale in buste mediante allocazioni separate, eventualmente nello stesso comando.
- Entrata +800 €: `C +800`, `U +800`.
- Assegnazione di 200 € a Risparmi: `U -200`, `E[Risparmi] +200`; `C` invariato.
- Spesa di 20 € da Svago: `C -20`, `E[Svago] -20`.
- Trasferimento di 30 € da Svago a Spesa: `E[Svago] -30`, `E[Spesa] +30`; `C` invariato.
- Restituzione di 25 € da una busta ai soldi liberi: `E -25`, `U +25`.
- Rimborso effettivo di 15 € riferito a una spesa: `C +15`, `E[busta originale] +15`; collegamento alla spesa originaria, per non gonfiare le entrate ordinarie.

Una spesa usa una busta nella prima versione. Suddivisione di un singolo acquisto su più buste non richiesta; la copertura può provenire da più sorgenti.

Rimborsi collegati non possono superare l'importo della spesa al netto dei rimborsi già registrati. Se l'importo originario era errato, correggere prima la spesa. Eliminare o correggere un movimento modifica soltanto quel movimento e gli elementi del comando che l'utente sceglie esplicitamente di annullare; mostrare anteprima dell'effetto sulle coperture collegate e sui mesi successivi.

## 3. Saldo iniziale e tempo

Un solo saldo iniziale con data civile. Le operazioni ordinarie non precedono quella data. Per aggiungere storia precedente occorre un flusso esplicito che riveda data iniziale e saldo: non generare storia automaticamente.

Date finanziarie `YYYY-MM-DD`; mesi `YYYY-MM`; timestamp tecnici UTC. Non convertire una data finanziaria mediante parsing UTC che possa cambiarne il giorno locale. Input «12,50» diventa 1250 centesimi; rifiutare precisione oltre due decimali e formati ambigui. Visualizzazione con `Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' })`.

Movimenti futuri appartengono alle previsioni, non al saldo attuale. Il comando ordinario di registrazione accetta oggi o date precedenti valide.

## 4. Buste e passaggio di mese

Tipi: spesa, risparmio, obiettivo. Il tipo aiuta la presentazione; non cambia l'invariante.

Per ogni busta scegliere `carry` oppure `release-positive`:

- `carry`: disponibilità conservata nel mese successivo.
- `release-positive`: l'avanzo positivo al termine del mese torna in `U`; la busta riparte da zero.
- Un deficit non si cancella al cambio di mese, con nessuna delle due modalità.

Il riepilogo del mese passato mostra il suo avanzo prima del rilascio. Il saldo iniziale del nuovo mese include il rilascio. Applicare passaggio di mese prima delle operazioni datate il primo giorno.

Il rilascio è un effetto derivato della proiezione cronologica, non un secondo movimento persistito con importo fisso. Correggere una spesa storica ricalcola i riporti successivi; non lasciare rilasci obsoleti. Le politiche delle buste sono versionate per mese: modificarle oggi non riscrive i mesi precedenti.

Non cancellare buste con storia. Archiviarle dopo trasferimento del saldo residuo, oppure mantenerle visibili finché hanno un deficit. I movimenti conservano riferimenti leggibili.

## 5. Piano mensile

Template con quote fisse per busta e versioni valide dal mese scelto. La somma delle quote è la richiesta mensile; il finanziamento usa `U` realmente disponibile.

Innesco normale: entrata principale ricorrente del mese. Se manca una ricorrenza principale, l'utente può applicare il piano dal riepilogo dopo un'entrata manuale. L'onboarding offre applicazione esplicita sul saldo iniziale. Non allocare automaticamente denaro soltanto perché cambia il mese.

Quando `U` copre tutte le quote, generare allocazioni e marcatore del mese in un commit. Resto in `U`. Quote del piano e quota dell'obiettivo riferita alla stessa busta rappresentano una sola allocazione, mai due.

Quando `U` non basta, stato `needs-review`: nessuna quota viene eseguita. L'utente modifica il piano del mese e conferma manualmente. Un'ulteriore entrata non sblocca quel piano senza conferma.

Un piano già applicato non si riesegue all'apertura, al cambio template o all'aumento del reddito. Una revisione nel mese genera soltanto il delta confermato dall'utente. Correggere l'entrata originaria non modifica silenziosamente assegnazioni già effettuate; esporre eventuale deficit.

## 6. Sforamenti

Per una spesa manuale con busta insufficiente e `C` sufficiente, richiedere prima le sorgenti di copertura: altre buste o `U`. Mostrare importo mancante e disponibilità di ogni sorgente. Nessun trasferimento implicito da risparmi o obiettivi.

Non prelevare più del saldo positivo di una sorgente. Somma dei trasferimenti deve coprire la differenza. Trasferimenti e uscita sono un singolo comando; annullare il dialog non salva nulla.

Se `C` non copre l'intera spesa reale, consentirne registrazione, con `C` negativo; la busta interessata può restare negativa se non coperta. Eventuale copertura parziale resta una scelta esplicita; non inventare entrate o nascondere lo scoperto con zero.

Una ricorrenza automatica viene invece registrata anche se la busta non basta, indipendentemente da `C`. La busta negativa crea una richiesta visibile di copertura da risolvere manualmente. Questa eccezione è stata scelta esplicitamente dall'utente.

Correzioni retroattive e rimborsi possono cambiare saldi successivi. Mostrare effetti prima della conferma; non alterare altri movimenti per ripristinare artificialmente disponibilità positive.

## 7. Ricorrenze

Registrazione automatica delle occorrenze dovute fino a oggi, solo mentre l'app viene eseguita. Conservare giorno originario come ancora: scadenza mensile del 31 → ultimo giorno a febbraio, poi 31 a marzo; ricorrenza annuale del 29 febbraio → ultimo giorno di febbraio negli anni non bisestili, poi 29 nell'anno bisestile.

Ogni occorrenza ha chiave stabile `ruleId + scheduledDate`; indice univoco e commit atomico con movimento. Riaperture, retry, due tab e crash non generano doppioni. Per lo stesso giorno, generare entrate, eventuale piano, poi uscite. Recupero di più mesi rigorosamente cronologico.

Regole con validità datata: modifiche di importo o frequenza non cambiano occorrenze già registrate. Disattivazione interrompe scadenze future, mantiene storia. Modifica di una singola occorrenza mantiene la sua chiave; eliminazione lascia stato `skipped` per impedirne la rigenerazione.

Mostrare origine automatica e azione «Correggi». L'app presume che la scadenza sia avvenuta: non dispone di una conferma della banca.

## 8. Obiettivi

Una busta obiettivo dedicata per ogni obiettivo attivo; non riutilizzare lo stesso saldo come copertura di due acquisti. Accantonato = disponibilità positiva attuale della busta. Mostrare anche un eventuale deficit, senza usarlo come progresso.

`R = max(0, prezzo - max(0, saldoBusta))`. Con quota mensile `q > 0`, numero quote = `ceil(R / q)`. La data è la data del versamento pianificato che completa il numero di quote; usare il calendario dell'entrata principale, non un'approssimazione di 30 giorni.

Se manca una ricorrenza principale, il simulatore chiede un giorno mensile di accantonamento, usato soltanto per la previsione. Applicare gli stessi criteri di fine mese delle ricorrenze. Questo calendario non genera entrate né finanziamenti automatici.

Contare soltanto versamenti futuri non ancora effettuati. Se il piano del mese è già applicato, la prima quota stimata è quella successiva. Se il piano è in attesa, non fingere che la quota del mese sia stata accantonata; il simulatore deve esplicitare se include una quota ancora da confermare.

Inverso: con `n` quote future entro la data scelta, quota necessaria in centesimi = `ceil(R / n)`. Se `n = 0` e `R > 0`, indicare che la data non è raggiungibile con il calendario scelto. Prezzo raggiunto → nessuna quota ulteriore necessaria. Quota zero → nessuna data stimabile.

Previsione condizionata al mantenimento delle quote e dell'entrata, mai garanzia. Se totale delle quote previste supera disponibilità mensile attesa al netto degli altri impegni, mostrare incompatibilità del piano. Gli abbonamenti sono uscite delle rispettive buste: non sottrarli due volte quando si controlla il piano.

Acquistare genera uscita reale e stato obiettivo completato; il raggiungimento del prezzo non registra da solo l'acquisto. Un eventuale residuo resta nella busta fino a scelta esplicita.
