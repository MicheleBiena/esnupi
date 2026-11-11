# esnupi — design system

## Direzione

Riferimento visivo Peanuts, con carta crema, inchiostro nero, rosso cuccia e giallo Woodstock. Numeri e controlli leggibili, senza banner o riempitivi decorativi. Il logo basta per il marchio. Le grafiche definitive saranno inserite dal committente: usare soltanto placeholder neutri.

## Voce e pronomi

Testi brevi e funzionali: etichette, spiegazioni delle funzioni, stati ed errori. Niente slogan, motti, frasi motivazionali, metafore su sogni o piccoli passi, o celebrazioni generiche. Non sostituire un motto con un altro. Preferire «Obiettivi», «Impostazioni», «Backup dei dati» e «Nessun movimento» a nomi metaforici.

Il destinatario usa il maschile. Se serve rivolgersi direttamente a lui, usare «tato» oppure forme maschili. Preferire comunque istruzioni neutre, senza appellativi superflui. Queste indicazioni valgono anche per stati vuoti, onboarding, notifiche, titoli del browser e metadati.

Riferimento alla skill ui-ux-pro-max: eseguite ricerca `--design-system` e ricerche su stile disegnato a mano/accessibilità. Il risultato automatico proponeva anche una landing e OLED: scartati perché incoerenti con le preferenze raccolte. Applicate gerarchia, contrasto, focus, campi etichettati e controlli comodi; la richiesta web prevale sul riferimento React Native della skill.

## Token iniziali

Valori proposti da usare tramite custom properties, non ripetere hex nei componenti:

```css
:root {
  --color-paper: #fff8e8;
  --color-surface: #fffdf7;
  --color-ink: #24201e;
  --color-muted: #62584f;
  --color-primary: #a62b2b;
  --color-on-primary: #ffffff;
  --color-woodstock: #f2c94c;
  --color-on-woodstock: #24201e;
  --color-danger: #a62b2b;
  --color-focus: #24201e;
  --color-border: #24201e;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;
  --radius-control: 10px;
  --radius-panel: 18px 14px 20px 15px;
  --shadow-panel: 3px 3px 0 #24201e;
  --motion-fast: 160ms;
  --motion-normal: 220ms;
}
```

Giallo come superficie con testo scuro; mai giallo su crema per testo essenziale. Rosso azione e rosso deficit richiedono contesto, etichette e simboli distinguibili. Verificare contrasto su ogni coppia effettiva, inclusi disabled, errori e focus; target testo normale almeno 4.5:1.

Contrasti calcolati sui token iniziali: nero/carta 15.26:1, testo secondario/carta 6.55:1, bianco/rosso 7.00:1, nero/giallo 10.18:1. Questi controlli non sostituiscono la verifica delle combinazioni effettivamente usate nei componenti.

## Tipografia

- Corpo, form, navigazione e importi: system sans-serif, base 16px, interlinea 1.5.
- Titoli: stessa famiglia di sistema del corpo, con gerarchia di dimensioni e pesi. Nessun font decorativo da procurare in questa fase.
- Numeri: `font-variant-numeric: tabular-nums`; importi allineati nelle liste.
- Piccole note almeno 14px. Non usare calligrafia per lunghi elenchi o valori finanziari.
- Gerarchia suggerita: 32/24/20px per titoli, 16px corpo, 14px supporto; ingrandimento testo senza tagli.

## Layout e gerarchia

Desktop principale a 1280–1440px; sidebar circa 224px e contenuto con larghezza massima leggibile. Riepilogo con saldo e denaro da assegnare davanti a grafici o decorazioni. Lista buste e prossime scadenze immediatamente raggiungibili.

Soglie iniziali: sotto 768px una colonna; 768–1023px layout compatto; da 1024px sidebar. Verificare 375px, 768px e 1440px e orientamento orizzontale. Niente scroll orizzontale della pagina. Le tabelle si trasformano in righe/schede leggibili quando serve.

Pannelli come vignette: bordo nero 2px, ombra corta, angoli leggermente irregolari. Non ruotare campi, importi, tabelle o pulsanti. Le decorazioni possono uscire dai bordi soltanto senza coprire contenuti o focus.

## Snoopy e asset

Il committente inserirà le grafiche definitive. Non generare, disegnare, cercare o scaricare illustrazioni. Lasciare il logo testuale e un placeholder neutro dove è già previsto uno spazio grafico; non aggiungere illustrazioni a dashboard, stati vuoti o traguardi.

L'illustrazione provvisoria `roof-day.svg` è stata rimossa su indicazione editoriale. Il placeholder dell'onboarding è realizzato in CSS. Tenere aggiornato `public/assets/ASSETS.md` quando il committente aggiungerà i propri file. L'assenza di grafiche definitive non blocca lo sviluppo funzionale e non richiede di chiedere al committente di fornirle prima di continuare.

Icone funzionali da una famiglia SVG coerente, sempre accompagnate da etichette quando il significato non è immediato. Illustrazioni decorative con alt vuoto; immagini informative con alt breve. Asset con dimensioni esplicite per evitare spostamenti del layout.

## Componenti e comportamento

- Un'azione primaria per schermata. Secondarie con bordo; distruttive separate.
- Pulsanti con area almeno 44×44px, spazio almeno 8px, focus visibile e stato di pressione.
- Campo importo con etichetta, suffisso EUR, `inputmode="decimal"`, istruzioni sul formato ed errore sotto il campo.
- Dialog di copertura: spesa, saldo busta, differenza, sorgenti e residuo. Totali aggiornati senza nascondere i campi.
- Stato salvataggio e conferma breve dopo commit. Errore mantiene dati e indica come riprovare.
- Eliminazione con conseguenze visibili e conferma; annullamento disponibile quando realizzabile senza ambiguità.
- Busta negativa: valore negativo, testo «Da coprire» e azione. Non affidarsi al rosso.
- Importi vuoti, caricamento ed errori distinti dal valore zero.
- Barre obiettivo con importi e quota restante; testo e tabella accessibile per ogni grafico.

## Movimento e accessibilità

Transizioni 160–220ms su opacity/transform; rispettare `prefers-reduced-motion`. Niente tremolio su errori, animazioni continue o celebrazioni che bloccano input.

HTML semantico, ordine tab naturale, skip link, intestazioni ordinate, dialog con focus gestito e chiusura da tastiera, ripristino focus al controllo originario. Cambio pagina porta focus al contenuto principale. Messaggi di salvataggio con live region non invasiva. Contrasto e zoom verificati anche nei form aperti.

Tema chiaro soltanto nella prima versione. Se verrà richiesta modalità scura, definire coppie di token e verificarle separatamente.

## Override delle pagine

Eventuali differenze future in `design-system/pages/<pagina>.md`. Specificare soltanto scostamenti motivati; le regole di questo documento restano valide nel resto dell'app.
