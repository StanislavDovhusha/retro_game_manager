// Italian translations of server messages. The key is the English source text.
export const it: Readonly<Record<string, string>> = {
  'SD card root': 'Radice della scheda SD',
  'Games folder': 'Cartella dei giochi',
  'Images folder: this is a file, not a folder — {imagesDir}': 'Cartella delle immagini: è un file, non una cartella — {imagesDir}',
  'CSV file: the path is not a file — {csvPath}': 'File CSV: il percorso non è un file — {csvPath}',
  'CSV file folder': 'Cartella del file CSV',
  'Invalid CSV delimiter': 'Separatore CSV non valido',
  'Invalid CSV encoding': 'Codifica CSV non valida',
  'Column {v0}': 'Colonna {v0}',
  'Could not read the CSV file: {message}': 'Impossibile leggere il file CSV: {message}',
  'The CSV could not be parsed (check the delimiter and encoding): {message}':
    'Impossibile interpretare il CSV (controlla il separatore e la codifica): {message}',
  'Could not create a CSV backup; the file was not changed: {message}':
    'Impossibile creare un backup del CSV; il file non è stato modificato: {message}',
  'Could not save the CSV (the original file is untouched, backup: {v0}): {message}':
    'Impossibile salvare il CSV (il file originale è intatto, backup: {v0}): {message}',
  'not needed': 'non necessario',
  'The CSV has no columns — check the file structure in the settings':
    'Il CSV non ha colonne: controlla la struttura del file nelle impostazioni',
  'Column “{name}” ({label}) was not found in the CSV': 'La colonna «{name}» ({label}) non è stata trovata nel CSV',
  'file path': 'percorso del file',
  'game title': 'titolo del gioco',
  'short name': 'nome breve',
  'the result size ({size}) does not match the expected size ({expectedSize})':
    'la dimensione del risultato ({size}) non corrisponde a quella prevista ({expectedSize})',
  'CSV and text files': 'File CSV e di testo',
  'All files': 'Tutti i file',
  Images: 'Immagini',
  'Choose a folder': 'Scegli una cartella',
  Games: 'Giochi',
  'Unknown file type': 'Tipo di file sconosciuto',
  'Choose files': 'Scegli i file',
  'Choose a file': 'Scegli un file',
  'The system dialog is unavailable (install zenity or kdialog). Enter the path manually.':
    'La finestra di sistema non è disponibile (installa zenity o kdialog). Inserisci il percorso a mano.',
  'Could not open the system dialog: {message}': 'Impossibile aprire la finestra di sistema: {message}',
  'The .cue refers to a file of type {type}: only .bin images (BINARY) are supported':
    'Il file .cue fa riferimento a un file di tipo {type}: sono supportate solo le immagini .bin (BINARY)',
  'The .cue has a TRACK line before FILE — the file is corrupted': 'Nel file .cue c’è una riga TRACK prima di FILE: il file è danneggiato',
  'The .cue uses an unsupported track mode: {mode}': 'Il file .cue usa una modalità di traccia non supportata: {mode}',
  'The tracks in “{name}” have different sector sizes — such an image is not supported':
    'Le tracce in «{name}» hanno dimensioni di settore diverse: questo tipo di immagine non è supportato',
  'The .cue has no FILE lines — this is not a cue file': 'Il file .cue non contiene righe FILE: non è un file cue',
  'No TRACK is specified in the .cue for the file “{name}”': 'Nel file .cue non è indicato alcun TRACK per il file «{name}»',
  'Selected .bin files have identical names': 'I file .bin selezionati hanno nomi identici',
  'The file “{name}” is listed several times in the .cue': 'Il file «{name}» è elencato più volte nel file .cue',
  'The .cue refers to the file “{name}”, but it is not selected. Select it together with the .cue.':
    'Il file .cue fa riferimento al file «{name}», che però non è selezionato. Selezionalo insieme al .cue.',
  'The file “{fileName}” is not listed in the .cue — remove it from the selection.':
    'Il file «{fileName}» non è elencato nel file .cue: rimuovilo dalla selezione.',
  'The SD card root is not selected': 'La radice della scheda SD non è selezionata',
  'System folders of the console cannot be modified: {p}': 'Le cartelle di sistema della console non possono essere modificate: {p}',
  'Platform “{name}” was not found on the memory card': 'La piattaforma «{name}» non è stata trovata sulla scheda di memoria',
  'The path goes outside the folder': 'Il percorso esce dalla cartella',
  'Folder not found': 'Cartella non trovata',
  'Request from a disallowed origin': 'Richiesta da un’origine non consentita',
  'application/json is expected': 'È previsto application/json',
  'API method not found': 'Metodo API non trovato',
  'Invalid JSON': 'JSON non valido',
  'No access to the file or folder: {v0}': 'Nessun accesso al file o alla cartella: {v0}',
  'Internal server error': 'Errore interno del server',
  'Could not prepare the uploads folder:': 'Impossibile preparare la cartella dei caricamenti:',
  'Retro Game Manager: API at http://{HOST}:{PORT}': 'Retro Game Manager: API su http://{HOST}:{PORT}',
  ' (the UI is built — open this address)': ' (l’interfaccia è compilata: apri questo indirizzo)',
  ' (development mode: the UI is at http://localhost:5173)': ' (modalità sviluppo: l’interfaccia è su http://localhost:5173)',
  'Server started': 'Server avviato',
  'Games folder: {gamesDir}': 'Cartella dei giochi: {gamesDir}',
  'CSV file: {csvPath}': 'File CSV: {csvPath}',
  'Images folder: {v0}': 'Cartella delle immagini: {v0}',
  'SD card root: {root}': 'Radice della scheda SD: {root}',
  'Console model recognized by the card: {name}': 'Modello di console riconosciuto dalla scheda: {name}',
  'Platform {name}: games — {gamesDir}, images — {imagesDir}, CSV — {csvPath}':
    'Piattaforma {name}: giochi — {gamesDir}, immagini — {imagesDir}, CSV — {csvPath}',
  'Deletion requires confirmation': 'L’eliminazione richiede una conferma',
  'Image not found': 'Immagine non trovata',
  'Cleaning the CSV requires confirmation': 'La pulizia del CSV richiede una conferma',
  'No files selected': 'Nessun file selezionato',
  'Invalid file name': 'Nome di file non valido',
  'File name not specified': 'Nome del file non specificato',
  'Sync requires confirmation': 'La sincronizzazione richiede una conferma',
  'Not enough disk space': 'Spazio su disco insufficiente',
  'No access: {what}': 'Nessun accesso: {what}',
  'The folder is read-only: {what}': 'La cartella è di sola lettura: {what}',
  'Supported images: PNG, JPG, JPEG, WEBP (also BMP, GIF)': 'Immagini supportate: PNG, JPG, JPEG, WEBP (anche BMP, GIF)',
  'Choose a game file (an image does not fit here)': 'Scegli un file di gioco (qui non va un’immagine)',
  'The .{ext} extension is not in the list of game extensions ({v1}). Add it in “Settings → Extensions”.':
    'L’estensione .{ext} non è nell’elenco delle estensioni di gioco ({v1}). Aggiungila in «Impostazioni → Estensioni».',
  'No file selected': 'Nessun file selezionato',
  'File not found: {name}': 'File non trovato: {name}',
  'file “{name}”': 'file «{name}»',
  '“{name}” is not a file': '«{name}» non è un file',
  'The file “{name}” is empty': 'Il file «{name}» è vuoto',
  'A game file name cannot be built from this title — change the title':
    'Da questo titolo non si può ricavare un nome per il file del gioco: modificalo',
  'Too many files (no more than {MAX_FILES})': 'Troppi file (massimo {MAX_FILES})',
  'Several .bin files need a .cue file that describes the tracks': 'Più file .bin hanno bisogno di un file .cue che descriva le tracce',
  'Several .cue files selected. Add one game at a time: one .cue and its .bin files.':
    'Hai selezionato più file .cue. Aggiungi un gioco alla volta: un .cue e i suoi file .bin.',
  'No .bin is selected for “{fileName}”. You need to select: {v1}':
    'Nessun file .bin selezionato per «{fileName}». Occorre selezionare: {v1}',
  'Tracks with different sector sizes cannot be merged into one .img':
    'Le tracce con dimensioni di settore diverse non possono essere unite in un unico .img',
  'The size of “{fileName}” is not a multiple of the sector size ({sector} bytes): the file is corrupted or does not match the .cue':
    'La dimensione di «{fileName}» non è un multiplo della dimensione del settore ({sector} byte): il file è danneggiato o non corrisponde al .cue',
  'The .cue has {tracks} tracks. Track boundaries are not preserved in a single .img':
    'Il file .cue ha {tracks} tracce. In un unico .img i confini delle tracce non vengono conservati',
  ', and audio tracks (CDDA) may not play.': ', e le tracce audio (CDDA) potrebbero non essere riprodotte.',
  'adding a game': 'aggiunta di un gioco',
  'The game title cannot be empty': 'Il titolo del gioco non può essere vuoto',
  'The game title is too long (200 characters maximum)': 'Il titolo del gioco è troppo lungo (massimo 200 caratteri)',
  'The title contains invalid characters': 'Il titolo contiene caratteri non validi',
  'The title needs at least one letter or digit': 'Il titolo deve contenere almeno una lettera o una cifra',
  'Choose the games folder first': 'Scegli prima la cartella dei giochi',
  'Choose the CSV file first': 'Scegli prima il file CSV',
  'games folder {gamesDir}': 'cartella dei giochi {gamesDir}',
  'reading the games folder': 'lettura della cartella dei giochi',
  'The game is already added: the file “{fileName}” exists in the games folder':
    'Il gioco è già stato aggiunto: il file «{fileName}» esiste nella cartella dei giochi',
  'A game titled “{cleanTitle}” is already in the CSV ({key}). Change the title.':
    'Nel CSV c’è già un gioco intitolato «{cleanTitle}» ({key}). Cambia il titolo.',
  'An image file name cannot be built from this title — change the title':
    'Da questo titolo non si può ricavare un nome per il file dell’immagine: modificalo',
  'reading the images folder': 'lettura della cartella delle immagini',
  'The image “{taken}” already exists in the images folder. Change the title or delete the old image.':
    'L’immagine «{taken}» esiste già nella cartella delle immagini. Cambia il titolo o elimina la vecchia immagine.',
  'Game “{cleanTitle}” was not added: {message}': 'Il gioco «{cleanTitle}» non è stato aggiunto: {message}',
  'could not copy the file': 'impossibile copiare il file',
  'The .{ext} extension was added to the list of game files': 'L’estensione .{ext} è stata aggiunta all’elenco dei file di gioco',
  'Could not add .{ext} to the extensions list ({message}) — add it in “Settings → Extensions”.':
    'Impossibile aggiungere .{ext} all’elenco delle estensioni ({message}): aggiungila in «Impostazioni → Estensioni».',
  'Games of the {platform} platform cannot be compressed to .zip':
    'I giochi della piattaforma {platform} non possono essere compressi in .zip',
  'The game file is larger than 4 GB and cannot be compressed to .zip':
    'Il file del gioco supera i 4 GB e non può essere compresso in .zip',
  ' (compressed to .zip, inside: {name})': ' (compresso in .zip, all’interno: {name})',
  'Game added “{cleanTitle}”: {dest}': 'Gioco aggiunto «{cleanTitle}»: {dest}',
  ' (image built from {length} .bin/.cue file(s))': ' (immagine creata da {length} file .bin/.cue)',
  '; image: {v0}': '; immagine: {v0}',
  ' (CSV entry updated)': ' (voce CSV aggiornata)',
  'No CSV file selected': 'Nessun file CSV selezionato',
  'editing the CSV': 'modifica del CSV',
  'CSV edited manually: {length} rows (backup: {backupPath})': 'CSV modificato a mano: {length} righe (backup: {backupPath})',
  'cleaning the CSV': 'pulizia del CSV',
  'The folder contents have changed: there are now {length} missing entries instead of {expected}. Run the check again.':
    'Il contenuto della cartella è cambiato: ora le voci mancanti sono {length} invece di {expected}. Ripeti il controllo.',
  'CSV cleanup: entries for missing games removed — {length} (backup: {backupPath})':
    'Pulizia del CSV: voci dei giochi mancanti rimosse — {length} (backup: {backupPath})',
  'deleting games': 'eliminazione dei giochi',
  'No games selected for deletion': 'Nessun gioco selezionato per l’eliminazione',
  'The games folder is not selected': 'La cartella dei giochi non è selezionata',
  'Only files can be deleted': 'Si possono eliminare solo file',
  'No access to the file': 'Nessun accesso al file',
  'Could not delete “{rel}”: {error}': 'Impossibile eliminare «{rel}»: {error}',
  'Deleting games: deleted {length}, already missing {length1}, errors {length2}':
    'Eliminazione dei giochi: eliminati {length}, già mancanti {length1}, errori {length2}',
  'Game file deleted: {r}': 'File del gioco eliminato: {r}',
  'CSV is not configured': 'Il CSV non è configurato',
  'The CSV file has not been created yet': 'Il file CSV non è ancora stato creato',
  'Entries removed from the CSV: {removed} (backup: {backupPath})': 'Voci rimosse dal CSV: {removed} (backup: {backupPath})',
  'No entries for these games were found in the CSV': 'Nel CSV non sono state trovate voci per questi giochi',
  'The files were deleted, but the CSV was not updated: {message}':
    'I file sono stati eliminati, ma il CSV non è stato aggiornato: {message}',
  'File not found — it may have already been deleted': 'File non trovato: potrebbe essere già stato eliminato',
  'This game has no image': 'Questo gioco non ha un’immagine',
  'The image is outside the selected folder': 'L’immagine si trova fuori dalla cartella selezionata',
  'Image deleted: {imageAbs}': 'Immagine eliminata: {imageAbs}',
  'An image outside the selected folders is not deleted from disk; only the link was removed: {imageAbs}':
    'Un’immagine esterna alle cartelle selezionate non viene eliminata dal disco; è stato rimosso solo il collegamento: {imageAbs}',
  Image: 'Immagine',
  'Supported formats: png, jpg, jpeg, bmp, gif, webp': 'Formati supportati: png, jpg, jpeg, bmp, gif, webp',
  'The folder is unavailable or has been deleted': 'La cartella non è disponibile o è stata eliminata',
  'Scan: games found — {games}, folders — {length} ({durationMs} ms)':
    'Scansione: giochi trovati — {games}, cartelle — {length} ({durationMs} ms)',
  'Could not read “{path}”: {message}': 'Impossibile leggere «{path}»: {message}',
  'Choose the CSV file in the settings first': 'Scegli prima il file CSV nelle impostazioni',
  'Some folders cannot be read, sync stopped: {path} — {message}':
    'Alcune cartelle non possono essere lette, sincronizzazione interrotta: {path} — {message}',
  'CSV sync': 'sincronizzazione del CSV',
  'CSV sync: started': 'Sincronizzazione del CSV: avviata',
  'Sync finished: added {toAdd}, removed {toRemove}, unchanged {unchanged}':
    'Sincronizzazione terminata: aggiunti {toAdd}, rimossi {toRemove}, invariati {unchanged}',
  '; backup: {backupPath}': '; backup: {backupPath}',
  '; the CSV was not changed': '; il CSV non è stato modificato',
  'Sync failed: {message}': 'Sincronizzazione non riuscita: {message}',
  'Not enough disk space to upload the file': 'Spazio su disco insufficiente per caricare il file',
  'Upload interrupted: {message}': 'Caricamento interrotto: {message}',
  'The file is empty': 'Il file è vuoto',
  'The uploaded file has expired — choose it again': 'Il file caricato è scaduto: sceglilo di nuovo',
  'The operation “{busy}” is in progress. Wait for it to finish.': 'L’operazione «{busy}» è in corso. Attendi che finisca.',
  'No folder selected': 'Nessuna cartella selezionata',
  'Invalid file path': 'Percorso del file non valido',
  'File not found': 'File non trovato',
  'The file is outside the selected folder': 'Il file si trova fuori dalla cartella selezionata',
  '{label}: folder not found or unavailable — {p}': '{label}: cartella non trovata o non disponibile — {p}',
  '{label}: file not found or unavailable — {p}': '{label}: file non trovato o non disponibile — {p}',
  'Only a game file can be renamed': 'Si può rinominare solo un file di gioco',
  'A file name cannot be made from this title — change the title': 'Da questo titolo non si può ricavare un nome di file: modificalo',
  'Two files would get the same name: {to}': 'Due file avrebbero lo stesso nome: {to}',
  'The file already exists: {to}': 'Il file esiste già: {to}',
  'The cover is outside the games and images folders — its name is not changed: {imageAbs}':
    'La copertina si trova fuori dalle cartelle dei giochi e delle immagini: il suo nome non viene modificato: {imageAbs}',
  'There is no entry for this game in the CSV — the CSV will not change':
    'Nel CSV non c’è alcuna voce per questo gioco: il CSV non cambierà',
  'The CSV file does not exist yet — the CSV will not change': 'Il file CSV non esiste ancora: il CSV non cambierà',
  'Select a platform on the SD card — then saves and lists in {folder} will be updated':
    'Seleziona una piattaforma sulla scheda SD: così verranno aggiornati i salvataggi e gli elenchi in {folder}',
  'The {folder} folder was not found on the card — saves and lists are left untouched':
    'La cartella {folder} non è stata trovata sulla scheda: i salvataggi e gli elenchi non vengono toccati',
  'Could not read {name}: {message}': 'Impossibile leggere {name}: {message}',
  'The file {name} is not UTF-8 text or is binary — skipped': 'Il file {name} non è testo UTF-8 oppure è binario: ignorato',
  'Nothing would change: the title and file name are already like this':
    'Non cambierebbe nulla: il titolo e il nome del file sono già questi',
  'renaming a game': 'rinomina di un gioco',
  'Renaming “{rel}” failed, changes were rolled back: {message}':
    'La rinomina di «{rel}» non è riuscita, le modifiche sono state annullate: {message}',
  'Could not rename: {message}': 'Impossibile rinominare: {message}',
  'The game was renamed, but the manually chosen cover was not carried over: {message}':
    'Il gioco è stato rinominato, ma la copertina scelta manualmente non è stata mantenuta: {message}',
  'Game renamed: “{from}” → “{to}” (files: {n}, lists and bindings: {m})':
    'Gioco rinominato: «{from}» → «{to}» (file: {n}, elenchi e associazioni: {m})',
  'Renaming requires confirmation': 'La rinomina richiede una conferma',
  'The request body is too large': 'Il corpo della richiesta è troppo grande',
  'Invalid request': 'Richiesta non valida',
  File: 'File',
  'This BMP variant is not supported: {detail}': 'Questa variante di BMP non è supportata: {detail}',
  'The BMP file is damaged or incomplete': 'Il file BMP è danneggiato o incompleto',
  'The picture is too large': 'L’immagine è troppo grande',
  'The file is not a valid image (PNG, JPG, WEBP, BMP or GIF)': 'Il file non è un’immagine valida (PNG, JPG, WEBP, BMP o GIF)',
  'Images folder': 'Cartella delle immagini',
  'CSV file': 'File CSV',
  'The file is too large (at most {max} MB)': 'Il file è troppo grande (massimo {max} MB)',
  '{label}: an absolute path is required': '{label}: è richiesto un percorso assoluto',
  '{label}: the path must be inside the SD card root — {value}':
    '{label}: il percorso deve trovarsi all’interno della radice della scheda SD — {value}',
  'An operation is in progress: “{operation}”': 'È in corso un’operazione: «{operation}»',
  'The application will close as soon as it finishes.': 'L’app si chiuderà non appena sarà terminata.',
  'Close when finished': 'Chiudi al termine',
  'Keep working': 'Continua a lavorare',
  'The short name cannot be empty': 'Il nome breve non può essere vuoto',
  'The short name is too long (128 characters maximum)': 'Il nome breve è troppo lungo (massimo 128 caratteri)',
  'The short name cannot contain spaces': 'Il nome breve non può contenere spazi',
  'A tag cannot contain a space — a space separates the tags: “{tag}”':
    'Un tag non può contenere spazi, perché lo spazio separa i tag: «{tag}»',
  'A tag is too long (the maximum is {max} characters): “{tag}”': 'Un tag è troppo lungo (massimo {max} caratteri): «{tag}»',
  'Too many tags (no more than {max})': 'Troppi tag (massimo {max})',
  'Nothing to change': 'Niente da modificare',
  'editing a game': 'modifica di un gioco',
  'Game data changed in the CSV: “{rel}” (backup: {csvBackupPath})': 'Dati del gioco modificati nel CSV: «{rel}» (backup: {csvBackupPath})',
  tags: 'tag',
  'The CSV has no column for the game title — choose it in the settings':
    'Il CSV non ha una colonna per il titolo del gioco: sceglila nelle impostazioni',
  'The CSV has no column for the short name — choose it in the settings':
    'Il CSV non ha una colonna per il nome breve: sceglila nelle impostazioni',
  'The CSV has no column for the tags — choose it in the settings': 'Il CSV non ha una colonna per i tag: sceglila nelle impostazioni',
  'Image conversion is unavailable: the "sharp" module could not be loaded ({message})':
    'La conversione delle immagini non è disponibile: impossibile caricare il modulo «sharp» ({message})',
  'The image could not be read or converted to PNG: {message}': 'Impossibile leggere l’immagine o convertirla in PNG: {message}',
  'changing a cover': 'cambio della copertina',
  'The old cover was removed: {file}': 'La vecchia copertina è stata rimossa: {file}',
  'The old cover could not be removed: {file} ({message})': 'Impossibile rimuovere la vecchia copertina: {file} ({message})',
  'Cover saved as PNG for the game “{rel}”: {imagePath}': 'Copertina salvata come PNG per il gioco «{rel}»: {imagePath}',
  'The file “{name}” is too large for a .{ext}': 'Il file «{name}» è troppo grande per essere un .{ext}',
  'Only the parts of one disc image can be selected together: .bin + .cue, .ccd + .img + .sub, or their .ecm archives':
    'Si possono selezionare insieme solo le parti di una stessa immagine disco: .bin + .cue, .ccd + .img + .sub o i relativi archivi .ecm',
  'Several .ccd files selected. Add one game at a time: one .ccd with its .img and .sub.':
    'Hai selezionato più file .ccd. Aggiungi un gioco alla volta: un .ccd con il suo .img e il suo .sub.',
  'The disc image set is incomplete. Missing: {files}. An .img or .bin may also be selected as an .ecm archive.':
    'L’immagine disco è incompleta. Manca: {files}. Al posto di un .img o di un .bin si può selezionare anche un archivio .ecm.',
  'The files {files} hold the same data — select only one of them': 'I file {files} contengono gli stessi dati: selezionane solo uno',
  'The files {files} do not belong to this disc image — remove them from the selection':
    'I file {files} non appartengono a questa immagine disco: rimuovili dalla selezione',
  'The ECM archive “{name}” is empty': 'L’archivio ECM «{name}» è vuoto',
  'The size of “{fileName}” is not a multiple of the CD sector size ({sector} bytes): the image is corrupted':
    'La dimensione di «{fileName}» non è un multiplo della dimensione del settore CD ({sector} byte): l’immagine è danneggiata',
  '“{name}” is not a CloneCD control file (no [CloneCD] section)':
    '«{name}» non è un file di controllo CloneCD (manca la sezione [CloneCD])',
  'The size of “{name}” does not match the image: the subchannel data may be wrong':
    'La dimensione di «{name}» non corrisponde all’immagine: i dati dei sottocanali potrebbero essere errati',
  ' (image from a CloneCD set)': ' (immagine da un set CloneCD)',
  ' (unpacked from ECM)': ' (estratto da ECM)',
  'Not enough free space: {need} MB is needed, {free} MB is available':
    'Spazio libero insufficiente: servono {need} MB, ne sono disponibili {free}',
  'The ECM archive “{name}” is damaged: {reason}': 'L’archivio ECM «{name}» è danneggiato: {reason}',
  'the file ends too early': 'il file termina troppo presto',
  'invalid record header': 'intestazione del record non valida',
  'this is not an ECM file (no ECM header)': 'non è un file ECM (manca l’intestazione ECM)',
  'the checksum of the unpacked data does not match': 'il checksum dei dati estratti non corrisponde',
  'The image “{taken}” is already in the images folder — it is used as the cover':
    'L’immagine «{taken}» è già nella cartella delle immagini: viene usata come copertina',
  'Cover could not be created: {message}': 'Impossibile creare la copertina: {message}',
  '; generated cover: {v0}': '; copertina generata: {v0}',
  'The generated cover could not be redrawn with the new title: {message}':
    'Impossibile ridisegnare la copertina generata con il nuovo titolo: {message}',
  'The CSV file was created: {csvPath}': 'Il file CSV è stato creato: {csvPath}',
  'The tags column was added to {count} CSV row(s)': 'La colonna dei tag è stata aggiunta (righe del CSV: {count})',
  'Old backups moved from the card to the computer: {count} (folder: {dir})':
    'Vecchi backup spostati dalla scheda al computer: {count} (cartella: {dir})',
  'Leftovers of interrupted writes removed from the card: {count}': 'Residui di scritture interrotte rimossi dalla scheda: {count}',
  'No file manager was found to open the folder: {dir}': 'Nessun file manager trovato per aprire la cartella: {dir}',
  'The folder could not be opened: {dir} ({message})': 'Impossibile aprire la cartella: {dir} ({message})',
  Emulator: 'Emulatore',
  'Emulator: the path does not exist — {path}': 'Emulatore: il percorso non esiste — {path}',
  Applications: 'Applicazioni',
  Programs: 'Programmi',
  'The emulator chosen in the settings was not found: {path}': 'L’emulatore scelto nelle impostazioni non è stato trovato: {path}',
  '{emulator} is not installed': '{emulator} non è installato',
  'The platform of the game is unknown: choose the platform folder on the SD card':
    'La piattaforma del gioco è sconosciuta: scegli la cartella della piattaforma sulla scheda SD',
  '{emulator} does not support {platform}': '{emulator} non supporta {platform}',
  '{emulator} cannot open .{ext} files of {platform}. Supported: {formats}':
    '{emulator} non può aprire i file .{ext} di {platform}. Supportati: {formats}',
  'Support for .{ext} files is coming in a future release.': 'Il supporto per i file .{ext} arriverà in una versione futura.',
  'No RetroArch core for {platform} is installed. Install one of: {cores} (RetroArch: Main Menu → Load Core → Download a Core)':
    'Non è installato alcun core RetroArch per {platform}. Installane uno tra: {cores} (RetroArch: Main Menu → Load Core → Download a Core)',
  'Games can be started in an emulator only in the desktop application':
    'I giochi si possono avviare in un emulatore solo nell’app desktop',
  '{emulator} could not be started: {message}': 'Impossibile avviare {emulator}: {message}',
  'Started in {emulator}: {rel}': 'Avviato in {emulator}: {rel}',
  'The title cannot contain the “|” character': 'Il titolo non può contenere il carattere «|»',
  'The short name cannot contain the “|” character': 'Il nome breve non può contenere il carattere «|»',
  'The title or short name of “{path}” contains “{separator}” — its line in {name} is not written':
    'Il titolo o il nome breve di «{path}» contiene «{separator}»: la sua riga in {name} non viene scritta',
  'Console lists updated: {lists}': 'Elenchi della console aggiornati: {lists}',
  'The console lists (.lst) could not be updated: {message}': 'Impossibile aggiornare gli elenchi della console (.lst): {message}',
  '{name} does not read correctly as {encoding} — it was not changed, so that it is not damaged':
    '{name} non si legge correttamente come {encoding}: non è stato modificato, per non danneggiarlo',
  '{name}: the new lines cannot be written in its encoding ({encoding}) — it was not changed':
    '{name}: le nuove righe non si possono scrivere nella sua codifica ({encoding}), quindi non è stato modificato',
  'Console list created (UTF-8): {lists}': 'Elenco della console creato (UTF-8): {lists}',
  'The previously selected SD card is not available ({reason}), its selection was reset: {root}':
    'La scheda SD scelta in precedenza non è disponibile ({reason}), la sua selezione è stata azzerata: {root}',
  'the path was not found': 'il percorso non è stato trovato',
  'no permission to read it': 'nessun permesso di lettura',
  'no permission to write to it': 'nessun permesso di scrittura',
  'no answer within {seconds} s': 'nessuna risposta entro {seconds} s',
  '{folder} is a media folder, not a game folder: no games or filelist.csv are added there':
    '{folder} è una cartella multimediale, non una cartella di giochi: lì non si aggiungono giochi né filelist.csv',
  'The title can contain only English letters, digits, spaces and the signs - _ ( ) [ ] . & # :':
    'Il titolo può contenere solo lettere inglesi, cifre, spazi e i segni - _ ( ) [ ] . & # :',
  'The short name can contain only English letters, digits and the signs - _ ( ) [ ] . & # :':
    'Il nome breve può contenere solo lettere inglesi, cifre e i segni - _ ( ) [ ] . & # :',
};
