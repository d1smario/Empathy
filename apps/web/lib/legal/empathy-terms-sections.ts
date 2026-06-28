/**
 * Termini di Servizio EMPATHY — testo GENERICO di base (diritto svizzero), in attesa del
 * testo legale definitivo che sarà sostituito dal Titolare. Volutamente sulle generali:
 * nessun segreto professionale, nessun dettaglio operativo riservato. Reso da
 * app/termini/page.tsx con lo stesso pattern di empathy-privacy-sections.ts.
 */
export type EmpathyTermsSection = { title: string; body: string[] };

/** Stringa statica (niente Date a runtime): aggiornare a mano alla pubblicazione del testo finale. */
export const empathyTermsLastUpdated = "giugno 2026";

export const empathyTermsSections: EmpathyTermsSection[] = [
  {
    title: "1. Oggetto e accettazione",
    body: [
      "I presenti Termini di Servizio (i «Termini») disciplinano l'accesso e l'utilizzo della piattaforma EMPATHY (il «Servizio»), gestita dal Titolare indicato nei Riferimenti. Registrandoti o utilizzando il Servizio dichiari di aver letto, compreso e accettato i Termini.",
      "Se non accetti i Termini non puoi utilizzare il Servizio. I Termini vanno letti insieme all'Informativa Privacy, che ne costituisce parte integrante.",
    ],
  },
  {
    title: "2. Descrizione del Servizio",
    body: [
      "EMPATHY è una piattaforma digitale per il monitoraggio e l'ottimizzazione di allenamento, nutrizione, fisiologia e recupero, che organizza i dati dell'utente in una rappresentazione integrata della performance e mette a disposizione strumenti per atleti e per i professionisti che li seguono.",
      "Il Servizio è offerto in continua evoluzione: funzioni, contenuti e disponibilità possono essere modificati, aggiunti o sospesi per finalità di miglioramento, sicurezza o conformità normativa.",
    ],
  },
  {
    title: "3. Account e registrazione",
    body: [
      "Per accedere alle funzioni riservate è necessario creare un account fornendo informazioni veritiere, complete e aggiornate. Sei responsabile della riservatezza delle credenziali e di ogni attività svolta tramite il tuo account.",
      "Gli account sono personali e non cedibili. Devi comunicarci tempestivamente qualsiasi uso non autorizzato o violazione della sicurezza.",
    ],
  },
  {
    title: "4. Requisiti d'uso",
    body: [
      "Il Servizio è rivolto a persone che abbiano l'età e la capacità legale per stipulare un contratto vincolante nel proprio Paese di residenza. I minori possono utilizzarlo soltanto con il consenso e sotto la responsabilità di chi esercita la potestà genitoriale.",
    ],
  },
  {
    title: "5. Ruolo del coach",
    body: [
      "La piattaforma consente a un professionista («coach») di accedere ai dati degli atleti a lui collegati, nei limiti dello scope autorizzato, per finalità di supporto e programmazione.",
      "Il rapporto professionale tra coach e atleta intercorre direttamente tra le parti: EMPATHY fornisce lo strumento tecnologico e, salvo ove diversamente indicato, non è parte di tale rapporto né garantisce i servizi resi dal coach.",
    ],
  },
  {
    title: "6. Abbonamenti, prezzi e pagamenti",
    body: [
      "Il Servizio può prevedere piani gratuiti e piani a pagamento, con eventuali contenuti aggiuntivi. Prezzi, durata e condizioni di ciascun piano sono indicati al momento della sottoscrizione.",
      "I pagamenti sono gestiti tramite fornitori terzi di servizi di pagamento; non conserviamo i dati completi degli strumenti di pagamento. Gli abbonamenti possono rinnovarsi automaticamente secondo quanto indicato in fase d'acquisto, salvo disdetta nei termini previsti. I prezzi possono essere aggiornati con congruo preavviso.",
    ],
  },
  {
    title: "7. Uso consentito",
    body: [
      "Ti impegni a utilizzare il Servizio in modo lecito e conforme ai Termini. È vietato, a titolo esemplificativo: violare leggi o diritti di terzi; tentare di accedere ad aree o dati non autorizzati; decompilare o effettuare reverse engineering; estrarre dati in modo massivo o automatizzato; compromettere la sicurezza o l'integrità del Servizio; condividere o cedere le credenziali.",
    ],
  },
  {
    title: "8. Contenuti e dati dell'utente",
    body: [
      "Mantieni la titolarità dei dati e dei contenuti che inserisci. Concedi a EMPATHY una licenza limitata a trattarli per erogare, mantenere e migliorare il Servizio, nei limiti dell'Informativa Privacy.",
      "Sei responsabile della correttezza dei dati inseriti: informazioni inesatte o incomplete possono ridurre l'affidabilità delle elaborazioni.",
    ],
  },
  {
    title: "9. Proprietà intellettuale",
    body: [
      "Il Servizio, il software, i modelli, le interfacce, i marchi e i contenuti messi a disposizione da EMPATHY sono protetti dai diritti di proprietà intellettuale del Titolare o dei suoi licenzianti.",
      "I Termini non trasferiscono alcun diritto di proprietà intellettuale se non quello, limitato e revocabile, di utilizzare il Servizio secondo le presenti condizioni.",
    ],
  },
  {
    title: "10. Salute e assenza di finalità medica",
    body: [
      "EMPATHY non è un dispositivo medico e non fornisce diagnosi, cure o consulenza medica. Le informazioni e le elaborazioni hanno finalità esclusivamente informative e di supporto alla performance.",
      "Prima di intraprendere o modificare un programma di allenamento o alimentare consulta un medico, in particolare in presenza di condizioni di salute particolari. L'attività fisica comporta rischi: la pratichi sotto la tua responsabilità.",
    ],
  },
  {
    title: "11. Servizi di terzi e integrazioni",
    body: [
      "Il Servizio può integrarsi con servizi e dispositivi di terzi (ad esempio sistemi di pagamento o sincronizzazione dei dati da dispositivi indossabili). L'uso di tali servizi è soggetto ai rispettivi termini e informative; EMPATHY non risponde del funzionamento dei servizi di terzi.",
    ],
  },
  {
    title: "12. Limitazione di responsabilità",
    body: [
      "Nei limiti consentiti dalla legge applicabile, il Servizio è fornito «così com'è» e «come disponibile», senza garanzie di assenza di errori o di continuità. EMPATHY non risponde di danni indiretti, perdita di dati o di profitto, né di conseguenze derivanti dall'uso improprio del Servizio o dalla pratica dell'attività fisica.",
      "Nulla nei Termini esclude o limita responsabilità che non possano essere escluse o limitate ai sensi della legge applicabile.",
    ],
  },
  {
    title: "13. Sospensione e cessazione",
    body: [
      "Possiamo sospendere o cessare l'accesso al Servizio in caso di violazione dei Termini, rischio per la sicurezza o obblighi di legge. Puoi cessare l'utilizzo e chiudere il tuo account in qualsiasi momento.",
      "Alla cessazione, le disposizioni che per loro natura devono sopravvivere (ad esempio proprietà intellettuale, limitazioni di responsabilità e legge applicabile) restano valide.",
    ],
  },
  {
    title: "14. Modifiche ai Termini",
    body: [
      "Possiamo aggiornare i Termini per riflettere evoluzioni del Servizio, normative o tecnologiche. In caso di modifiche rilevanti ne daremo opportuna informazione. L'uso continuato del Servizio dopo l'aggiornamento costituisce accettazione dei Termini modificati.",
    ],
  },
  {
    title: "15. Legge applicabile e foro",
    body: [
      "I Termini sono regolati dal diritto svizzero. Per ogni controversia è competente il foro di Lugano (Cantone Ticino, Svizzera), fatte salve le disposizioni inderogabili a tutela dei consumatori.",
    ],
  },
];
