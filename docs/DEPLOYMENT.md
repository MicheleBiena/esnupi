# Pubblicazione e gestione dei dati

## Stato

Prima versione implementata e pubblicata sotto `/esnupi/` all’indirizzo `https://michelebiena.github.io/esnupi/`. CI e deploy Pages sono definiti in `.github/workflows/ci.yml` e `.github/workflows/deploy.yml`, con action fissate a commit; entrambi sono stati eseguiti con successo su GitHub. Remoto: `https://github.com/MicheleBiena/esnupi.git`.

## GitHub Pages

GitHub Pages pubblica contenuti statici. Il codice dell'app e i suoi asset vengono distribuiti dal repository; le registrazioni dell'utente rimangono nel browser. Non committare backup, dati reali, schermate con saldi personali o file generati dall'uso dell'app. [GitHub: funzionamento Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).

Per un repository chiamato `esnupi`, URL atteso `https://<owner>.github.io/esnupi/` e Vite `base: '/esnupi/'`. Username/repository effettivi da raccogliere quando si pubblica. Se dominio o percorso cambiano, aggiornare la base. Hash routing evita necessità di fallback server alle route dell'app. [Vite: configurazione Pages](https://vite.dev/guide/static-deploy.html).

## Workflow predisposti

- CI su pull request e push: installazione riproducibile dal lockfile, test, typecheck, build ed E2E Chromium.
- Deploy su branch principale o avvio manuale: stessi controlli, caricamento di `dist/` come artefatto Pages e deploy ufficiale.
- Permessi di deploy minimi: `contents: read`, `pages: write`, `id-token: write`; environment `github-pages` e gruppo di concorrenza dedicato.
- Configurare Pages con sorgente GitHub Actions. Prima del primo push controllare periodicamente gli aggiornamenti delle action senza sostituire i riferimenti fissati con tag mobili.
- Non servono token GitHub nel frontend né variabili segrete per accedere ai dati locali.

La build deve servire tutti gli asset sotto la base del progetto. Non pubblicare cartelle di lavoro, backup o fixture privati insieme a `dist/`.

## Persistenza nel browser

IndexedDB è legato all'origin e al profilo del browser. Cambiare browser, dispositivo, profilo o dominio significa usare un altro archivio. Su un dominio GitHub Pages condiviso tra progetti, percorsi diversi condividono lo stesso origin: usare nomi storage specifici, senza presentare il percorso come isolamento di sicurezza. [MDN: IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API).

Il browser può rimuovere dati sotto pressione o quando l'utente cancella i dati del sito. La richiesta di persistenza tramite Storage API può ridurre alcune rimozioni automatiche, ma non sostituisce backup e non impedisce cancellazioni volontarie. Informazione breve in onboarding e impostazioni; promemoria export non invasivo. [MDN: quote e rimozione](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).

Archivio locale senza password interna: chi usa lo stesso profilo del PC può accedere all'app e ai dati. Nessuna promessa di cifratura o protezione dell'account. File JSON esportati contengono dati finanziari leggibili; indicarlo accanto all'export.

La dicitura «dati finanziari locali» riguarda le registrazioni dell'app. GitHub può trattare dati tecnici delle visite secondo la propria informativa; non promettere assenza totale di traffico o log del servizio di hosting. [GitHub: raccolta dati Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages).

## Backup e cambio PC

L'export completo produce un file nominato con data, per esempio `esnupi-backup-2026-11-11.json`. Il browser avvia download; non può garantire che l'utente conservi il file. La data dell'ultimo export indica creazione/download avviato, non verifica di copia esterna.

Per cambiare PC: esportare dal browser originale, trasferire file con mezzo scelto dall'utente e importare nel nuovo archivio. Trasferimento manuale non equivale a sincronizzazione. Importazione sostituisce dati dopo validazione e conferma nell'interfaccia.

## Aggiornamenti

Versionare separatamente schema DB e formato backup. Migrazione completata prima di eseguire comandi finanziari; nessun reset silenzioso se migrazione fallisce. Mantenere possibilità di esportare o recuperare dati con un percorso di errore comprensibile.

Nessun service worker nella prima versione: evitare cache dell'app obsolete e non promettere avvio offline. Gli addebiti dovuti mentre l'app era chiusa vengono registrati alla successiva apertura con data della scadenza e indicazione di origine automatica.

## Checklist prima della prima pubblicazione

Repository e owner corretti, base corretta, placeholder dichiarati (grafiche definitive a carico del committente), nessun dato reale nei file, scenari ACCEPTANCE verificati, backup ripristinabile, README con comandi reali e limiti dichiarati. Aprire URL finale restituito dal deploy e verificare il percorso dell'app con archivio sintetico.
