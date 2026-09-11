# Modelli di lingua per l'OCR dei referti

`ita.traineddata.gz` e `eng.traineddata.gz`: dati di riconoscimento di Tesseract (serie
`4.0.0_best_int`, la stessa che `tesseract.js` scarica di default da
`cdn.jsdelivr.net/npm/@tesseract.js-data/<lingua>/4.0.0_best_int`). Licenza Apache 2.0,
progetto tesseract-ocr/tessdata.

Stanno nel repo invece di arrivare dalla rete perché su Vercel:
- il download di ~8 MB si ripeteva a ogni avvio a freddo, da un servizio esterno;
- la cache predefinita di Tesseract è la cartella corrente, che lì è in sola lettura.

Li legge `lib/health/ocr-image.ts` (`langPath` locale, `gzip: true`, `cacheMethod: "none"`),
e `next.config.mjs` li include nella funzione della rotta di caricamento
(`outputFileTracingIncludes`). I file `.traineddata` non compressi sono cache di Tesseract e
sono ignorati da git.
