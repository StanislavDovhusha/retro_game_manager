// German translations of server messages. The key is the English source text.
export const de: Readonly<Record<string, string>> = {
  'SD card root': 'Stammordner der SD-Karte',
  'Games folder': 'Spieleordner',
  'Images folder: this is a file, not a folder — {imagesDir}': 'Bilderordner: Das ist eine Datei, kein Ordner – {imagesDir}',
  'CSV file: the path is not a file — {csvPath}': 'CSV-Datei: Der Pfad ist keine Datei – {csvPath}',
  'CSV file folder': 'Ordner der CSV-Datei',
  'Invalid CSV delimiter': 'Ungültiges CSV-Trennzeichen',
  'Invalid CSV encoding': 'Ungültige CSV-Kodierung',
  'Column {v0}': 'Spalte {v0}',
  'Could not read the CSV file: {message}': 'Die CSV-Datei ließ sich nicht lesen: {message}',
  'The CSV could not be parsed (check the delimiter and encoding): {message}':
    'Die CSV ließ sich nicht auswerten (prüfe Trennzeichen und Kodierung): {message}',
  'Could not create a CSV backup; the file was not changed: {message}':
    'Es konnte kein CSV-Backup angelegt werden; die Datei wurde nicht geändert: {message}',
  'Could not save the CSV (the original file is untouched, backup: {v0}): {message}':
    'Die CSV ließ sich nicht speichern (die Originaldatei ist unverändert, Backup: {v0}): {message}',
  'not needed': 'nicht nötig',
  'The CSV has no columns — check the file structure in the settings':
    'Die CSV hat keine Spalten – prüfe die Dateistruktur in den Einstellungen',
  'Column “{name}” ({label}) was not found in the CSV': 'Die Spalte „{name}“ ({label}) wurde in der CSV nicht gefunden',
  'file path': 'Dateipfad',
  'game title': 'Spieltitel',
  'short name': 'Kurzname',
  'the result size ({size}) does not match the expected size ({expectedSize})':
    'die Größe des Ergebnisses ({size}) stimmt nicht mit der erwarteten Größe ({expectedSize}) überein',
  'CSV and text files': 'CSV- und Textdateien',
  'All files': 'Alle Dateien',
  Images: 'Bilder',
  'Choose a folder': 'Ordner auswählen',
  Games: 'Spiele',
  'Unknown file type': 'Unbekannter Dateityp',
  'Choose files': 'Dateien auswählen',
  'Choose a file': 'Datei auswählen',
  'The system dialog is unavailable (install zenity or kdialog). Enter the path manually.':
    'Der Systemdialog ist nicht verfügbar (installiere zenity oder kdialog). Gib den Pfad von Hand ein.',
  'Could not open the system dialog: {message}': 'Der Systemdialog ließ sich nicht öffnen: {message}',
  'The .cue refers to a file of type {type}: only .bin images (BINARY) are supported':
    'Die .cue verweist auf eine Datei vom Typ {type}: Es werden nur .bin-Images (BINARY) unterstützt',
  'The .cue has a TRACK line before FILE — the file is corrupted': 'In der .cue steht eine TRACK-Zeile vor FILE – die Datei ist beschädigt',
  'The .cue uses an unsupported track mode: {mode}': 'Die .cue verwendet einen nicht unterstützten Track-Modus: {mode}',
  'The tracks in “{name}” have different sector sizes — such an image is not supported':
    'Die Tracks in „{name}“ haben unterschiedliche Sektorgrößen – ein solches Image wird nicht unterstützt',
  'The .cue has no FILE lines — this is not a cue file': 'Die .cue enthält keine FILE-Zeilen – das ist keine Cue-Datei',
  'No TRACK is specified in the .cue for the file “{name}”': 'Für die Datei „{name}“ ist in der .cue kein TRACK angegeben',
  'Selected .bin files have identical names': 'Die ausgewählten .bin-Dateien haben identische Namen',
  'The file “{name}” is listed several times in the .cue': 'Die Datei „{name}“ ist in der .cue mehrfach aufgeführt',
  'The .cue refers to the file “{name}”, but it is not selected. Select it together with the .cue.':
    'Die .cue verweist auf die Datei „{name}“, aber sie ist nicht ausgewählt. Wähle sie zusammen mit der .cue aus.',
  'The file “{fileName}” is not listed in the .cue — remove it from the selection.':
    'Die Datei „{fileName}“ steht nicht in der .cue – entferne sie aus der Auswahl.',
  'The SD card root is not selected': 'Der Stammordner der SD-Karte ist nicht ausgewählt',
  'System folders of the console cannot be modified: {p}': 'Systemordner der Konsole dürfen nicht verändert werden: {p}',
  'Platform “{name}” was not found on the memory card': 'Die Plattform „{name}“ wurde auf der Speicherkarte nicht gefunden',
  'The path goes outside the folder': 'Der Pfad führt aus dem Ordner hinaus',
  'Folder not found': 'Ordner nicht gefunden',
  'Request from a disallowed origin': 'Anfrage von einem nicht erlaubten Ursprung',
  'application/json is expected': 'application/json wird erwartet',
  'API method not found': 'API-Methode nicht gefunden',
  'Invalid JSON': 'Ungültiges JSON',
  'No access to the file or folder: {v0}': 'Kein Zugriff auf die Datei oder den Ordner: {v0}',
  'Internal server error': 'Interner Serverfehler',
  'Could not prepare the uploads folder:': 'Der Upload-Ordner ließ sich nicht vorbereiten:',
  'Retro Game Manager: API at http://{HOST}:{PORT}': 'Retro Game Manager: API unter http://{HOST}:{PORT}',
  ' (the UI is built — open this address)': ' (die Oberfläche ist gebaut – öffne diese Adresse)',
  ' (development mode: the UI is at http://localhost:5173)': ' (Entwicklungsmodus: Die Oberfläche läuft unter http://localhost:5173)',
  'Server started': 'Server gestartet',
  'Games folder: {gamesDir}': 'Spieleordner: {gamesDir}',
  'CSV file: {csvPath}': 'CSV-Datei: {csvPath}',
  'Images folder: {v0}': 'Bilderordner: {v0}',
  'SD card root: {root}': 'Stammordner der SD-Karte: {root}',
  'Console model recognized by the card: {name}': 'Konsolenmodell anhand der Karte erkannt: {name}',
  'Platform {name}: games — {gamesDir}, images — {imagesDir}, CSV — {csvPath}':
    'Plattform {name}: Spiele – {gamesDir}, Bilder – {imagesDir}, CSV – {csvPath}',
  'Deletion requires confirmation': 'Das Löschen muss bestätigt werden',
  'Image not found': 'Bild nicht gefunden',
  'Cleaning the CSV requires confirmation': 'Das Bereinigen der CSV muss bestätigt werden',
  'No files selected': 'Keine Dateien ausgewählt',
  'Invalid file name': 'Ungültiger Dateiname',
  'File name not specified': 'Kein Dateiname angegeben',
  'Sync requires confirmation': 'Die Synchronisierung muss bestätigt werden',
  'Not enough disk space': 'Nicht genug Speicherplatz',
  'No access: {what}': 'Kein Zugriff: {what}',
  'The folder is read-only: {what}': 'Der Ordner ist schreibgeschützt: {what}',
  'Supported images: PNG, JPG, JPEG, WEBP (also BMP, GIF)': 'Unterstützte Bilder: PNG, JPG, JPEG, WEBP (auch BMP, GIF)',
  'Choose a game file (an image does not fit here)': 'Wähle eine Spieldatei (ein Bild passt hier nicht)',
  'The .{ext} extension is not in the list of game extensions ({v1}). Add it in “Settings → Extensions”.':
    'Die Endung .{ext} steht nicht in der Liste der Spieldatei-Endungen ({v1}). Füge sie unter „Einstellungen → Endungen“ hinzu.',
  'No file selected': 'Keine Datei ausgewählt',
  'File not found: {name}': 'Datei nicht gefunden: {name}',
  'file “{name}”': 'Datei „{name}“',
  '“{name}” is not a file': '„{name}“ ist keine Datei',
  'The file “{name}” is empty': 'Die Datei „{name}“ ist leer',
  'A game file name cannot be built from this title — change the title':
    'Aus diesem Titel lässt sich kein Name für die Spieldatei bilden – ändere den Titel',
  'Too many files (no more than {MAX_FILES})': 'Zu viele Dateien (höchstens {MAX_FILES})',
  'Several .bin files need a .cue file that describes the tracks':
    'Mehrere .bin-Dateien brauchen eine .cue-Datei, die die Tracks beschreibt',
  'Several .cue files selected. Add one game at a time: one .cue and its .bin files.':
    'Mehrere .cue-Dateien ausgewählt. Füge immer nur ein Spiel hinzu: eine .cue und ihre .bin-Dateien.',
  'No .bin is selected for “{fileName}”. You need to select: {v1}': 'Für „{fileName}“ ist keine .bin ausgewählt. Auszuwählen ist: {v1}',
  'Tracks with different sector sizes cannot be merged into one .img':
    'Tracks mit unterschiedlichen Sektorgrößen lassen sich nicht zu einer .img zusammenführen',
  'The size of “{fileName}” is not a multiple of the sector size ({sector} bytes): the file is corrupted or does not match the .cue':
    'Die Größe von „{fileName}“ ist kein Vielfaches der Sektorgröße ({sector} Bytes): Die Datei ist beschädigt oder passt nicht zur .cue',
  'The .cue has {tracks} tracks. Track boundaries are not preserved in a single .img':
    'Die .cue hat {tracks} Tracks. In einer einzelnen .img bleiben die Track-Grenzen nicht erhalten',
  ', and audio tracks (CDDA) may not play.': ', und Audiotracks (CDDA) werden möglicherweise nicht abgespielt.',
  'adding a game': 'Spiel hinzufügen',
  'The game title cannot be empty': 'Der Spieltitel darf nicht leer sein',
  'The game title is too long (200 characters maximum)': 'Der Spieltitel ist zu lang (maximal 200 Zeichen)',
  'The title contains invalid characters': 'Der Titel enthält ungültige Zeichen',
  'The title needs at least one letter or digit': 'Der Titel braucht mindestens einen Buchstaben oder eine Ziffer',
  'Choose the games folder first': 'Wähle zuerst den Spieleordner',
  'Choose the CSV file first': 'Wähle zuerst die CSV-Datei',
  'games folder {gamesDir}': 'Spieleordner {gamesDir}',
  'reading the games folder': 'Lesen des Spieleordners',
  'The game is already added: the file “{fileName}” exists in the games folder':
    'Das Spiel ist bereits hinzugefügt: Die Datei „{fileName}“ existiert im Spieleordner',
  'A game titled “{cleanTitle}” is already in the CSV ({key}). Change the title.':
    'Ein Spiel mit dem Titel „{cleanTitle}“ steht bereits in der CSV ({key}). Ändere den Titel.',
  'An image file name cannot be built from this title — change the title':
    'Aus diesem Titel lässt sich kein Name für die Bilddatei bilden – ändere den Titel',
  'reading the images folder': 'Lesen des Bilderordners',
  'The image “{taken}” already exists in the images folder. Change the title or delete the old image.':
    'Das Bild „{taken}“ existiert bereits im Bilderordner. Ändere den Titel oder lösche das alte Bild.',
  'Game “{cleanTitle}” was not added: {message}': 'Das Spiel „{cleanTitle}“ wurde nicht hinzugefügt: {message}',
  'could not copy the file': 'die Datei ließ sich nicht kopieren',
  'The .{ext} extension was added to the list of game files': 'Die Endung .{ext} wurde in die Liste der Spieldateien aufgenommen',
  'Could not add .{ext} to the extensions list ({message}) — add it in “Settings → Extensions”.':
    '.{ext} ließ sich nicht in die Liste der Endungen aufnehmen ({message}) – füge sie unter „Einstellungen → Endungen“ hinzu.',
  'Games of the {platform} platform cannot be compressed to .zip':
    'Spiele der Plattform {platform} lassen sich nicht als .zip komprimieren',
  'The game file is larger than 4 GB and cannot be compressed to .zip':
    'Die Spieldatei ist größer als 4 GB und lässt sich nicht als .zip komprimieren',
  ' (compressed to .zip, inside: {name})': ' (als .zip komprimiert, Inhalt: {name})',
  'Game added “{cleanTitle}”: {dest}': 'Spiel hinzugefügt „{cleanTitle}“: {dest}',
  ' (image built from {length} .bin/.cue file(s))': ' (Image aus {length} .bin/.cue-Datei(en) erstellt)',
  '; image: {v0}': '; Bild: {v0}',
  ' (CSV entry updated)': ' (CSV-Eintrag aktualisiert)',
  'No CSV file selected': 'Keine CSV-Datei ausgewählt',
  'editing the CSV': 'CSV bearbeiten',
  'CSV edited manually: {length} rows (backup: {backupPath})': 'CSV von Hand bearbeitet: {length} Zeilen (Backup: {backupPath})',
  'cleaning the CSV': 'CSV bereinigen',
  'The folder contents have changed: there are now {length} missing entries instead of {expected}. Run the check again.':
    'Der Ordnerinhalt hat sich geändert: Jetzt fehlen {length} Einträge statt {expected}. Führe die Prüfung noch einmal aus.',
  'CSV cleanup: entries for missing games removed — {length} (backup: {backupPath})':
    'CSV-Bereinigung: Einträge für fehlende Spiele entfernt – {length} (Backup: {backupPath})',
  'deleting games': 'Spiele löschen',
  'No games selected for deletion': 'Keine Spiele zum Löschen ausgewählt',
  'The games folder is not selected': 'Der Spieleordner ist nicht ausgewählt',
  'Only files can be deleted': 'Es lassen sich nur Dateien löschen',
  'No access to the file': 'Kein Zugriff auf die Datei',
  'Could not delete “{rel}”: {error}': '„{rel}“ ließ sich nicht löschen: {error}',
  'Deleting games: deleted {length}, already missing {length1}, errors {length2}':
    'Spiele löschen: gelöscht {length}, bereits nicht mehr vorhanden {length1}, Fehler {length2}',
  'Game file deleted: {r}': 'Spieldatei gelöscht: {r}',
  'CSV is not configured': 'CSV ist nicht eingerichtet',
  'The CSV file has not been created yet': 'Die CSV-Datei wurde noch nicht angelegt',
  'Entries removed from the CSV: {removed} (backup: {backupPath})': 'Aus der CSV entfernte Einträge: {removed} (Backup: {backupPath})',
  'No entries for these games were found in the CSV': 'Für diese Spiele wurden in der CSV keine Einträge gefunden',
  'The files were deleted, but the CSV was not updated: {message}':
    'Die Dateien wurden gelöscht, aber die CSV wurde nicht aktualisiert: {message}',
  'File not found — it may have already been deleted': 'Datei nicht gefunden – möglicherweise wurde sie bereits gelöscht',
  'This game has no image': 'Dieses Spiel hat kein Bild',
  'The image is outside the selected folder': 'Das Bild liegt außerhalb des gewählten Ordners',
  'Image deleted: {imageAbs}': 'Bild gelöscht: {imageAbs}',
  'An image outside the selected folders is not deleted from disk; only the link was removed: {imageAbs}':
    'Ein Bild außerhalb der gewählten Ordner wird nicht vom Datenträger gelöscht; nur die Verknüpfung wurde entfernt: {imageAbs}',
  Image: 'Bild',
  'Supported formats: png, jpg, jpeg, bmp, gif, webp': 'Unterstützte Formate: png, jpg, jpeg, bmp, gif, webp',
  'The folder is unavailable or has been deleted': 'Der Ordner ist nicht erreichbar oder wurde gelöscht',
  'Scan: games found — {games}, folders — {length} ({durationMs} ms)':
    'Scan: Spiele gefunden – {games}, Ordner – {length} ({durationMs} ms)',
  'Could not read “{path}”: {message}': '„{path}“ ließ sich nicht lesen: {message}',
  'Choose the CSV file in the settings first': 'Wähle zuerst die CSV-Datei in den Einstellungen',
  'Some folders cannot be read, sync stopped: {path} — {message}':
    'Einige Ordner lassen sich nicht lesen, Synchronisierung abgebrochen: {path} – {message}',
  'CSV sync': 'CSV-Synchronisierung',
  'CSV sync: started': 'CSV-Synchronisierung: gestartet',
  'Sync finished: added {toAdd}, removed {toRemove}, unchanged {unchanged}':
    'Synchronisierung beendet: hinzugefügt {toAdd}, entfernt {toRemove}, unverändert {unchanged}',
  '; backup: {backupPath}': '; Backup: {backupPath}',
  '; the CSV was not changed': '; die CSV wurde nicht geändert',
  'Sync failed: {message}': 'Synchronisierung fehlgeschlagen: {message}',
  'Not enough disk space to upload the file': 'Nicht genug Speicherplatz, um die Datei hochzuladen',
  'Upload interrupted: {message}': 'Upload unterbrochen: {message}',
  'The file is empty': 'Die Datei ist leer',
  'The uploaded file has expired — choose it again': 'Die hochgeladene Datei ist abgelaufen – wähle sie noch einmal aus',
  'The operation “{busy}” is in progress. Wait for it to finish.': 'Der Vorgang „{busy}“ läuft gerade. Warte, bis er abgeschlossen ist.',
  'No folder selected': 'Kein Ordner ausgewählt',
  'Invalid file path': 'Ungültiger Dateipfad',
  'File not found': 'Datei nicht gefunden',
  'The file is outside the selected folder': 'Die Datei liegt außerhalb des gewählten Ordners',
  '{label}: folder not found or unavailable — {p}': '{label}: Ordner nicht gefunden oder nicht erreichbar – {p}',
  '{label}: file not found or unavailable — {p}': '{label}: Datei nicht gefunden oder nicht erreichbar – {p}',
  'Only a game file can be renamed': 'Nur eine Spieldatei lässt sich umbenennen',
  'A file name cannot be made from this title — change the title': 'Aus diesem Titel lässt sich kein Dateiname bilden – ändere den Titel',
  'Two files would get the same name: {to}': 'Zwei Dateien würden denselben Namen erhalten: {to}',
  'The file already exists: {to}': 'Die Datei existiert bereits: {to}',
  'The cover is outside the games and images folders — its name is not changed: {imageAbs}':
    'Das Cover liegt außerhalb des Spiele- und des Bilderordners – sein Name wird nicht geändert: {imageAbs}',
  'There is no entry for this game in the CSV — the CSV will not change':
    'Für dieses Spiel gibt es keinen Eintrag in der CSV – die CSV bleibt unverändert',
  'The CSV file does not exist yet — the CSV will not change': 'Die CSV-Datei existiert noch nicht – die CSV bleibt unverändert',
  'Select a platform on the SD card — then saves and lists in {folder} will be updated':
    'Wähle eine Plattform auf der SD-Karte – dann werden Speicherstände und Listen in {folder} aktualisiert',
  'The {folder} folder was not found on the card — saves and lists are left untouched':
    'Der Ordner {folder} wurde auf der Karte nicht gefunden – Speicherstände und Listen bleiben unberührt',
  'Could not read {name}: {message}': '{name} ließ sich nicht lesen: {message}',
  'The file {name} is not UTF-8 text or is binary — skipped': 'Die Datei {name} ist kein UTF-8-Text oder binär – übersprungen',
  'Nothing would change: the title and file name are already like this':
    'Es würde sich nichts ändern: Titel und Dateiname lauten bereits so',
  'renaming a game': 'Spiel umbenennen',
  'Renaming “{rel}” failed, changes were rolled back: {message}':
    'Das Umbenennen von „{rel}“ ist fehlgeschlagen, die Änderungen wurden rückgängig gemacht: {message}',
  'Could not rename: {message}': 'Umbenennen fehlgeschlagen: {message}',
  'The game was renamed, but the manually chosen cover was not carried over: {message}':
    'Das Spiel wurde umbenannt, aber das manuell gewählte Cover wurde nicht übernommen: {message}',
  'Game renamed: “{from}” → “{to}” (files: {n}, lists and bindings: {m})':
    'Spiel umbenannt: „{from}“ → „{to}“ (Dateien: {n}, Listen und Zuordnungen: {m})',
  'Renaming requires confirmation': 'Das Umbenennen muss bestätigt werden',
  'The request body is too large': 'Der Anfragetext ist zu groß',
  'Invalid request': 'Ungültige Anfrage',
  File: 'Datei',
  'This BMP variant is not supported: {detail}': 'Diese BMP-Variante wird nicht unterstützt: {detail}',
  'The BMP file is damaged or incomplete': 'Die BMP-Datei ist beschädigt oder unvollständig',
  'The picture is too large': 'Das Bild ist zu groß',
  'The file is not a valid image (PNG, JPG, WEBP, BMP or GIF)': 'Die Datei ist kein gültiges Bild (PNG, JPG, WEBP, BMP oder GIF)',
  'Images folder': 'Bilderordner',
  'CSV file': 'CSV-Datei',
  'The file is too large (at most {max} MB)': 'Die Datei ist zu groß (höchstens {max} MB)',
  '{label}: an absolute path is required': '{label}: Ein absoluter Pfad ist erforderlich',
  '{label}: the path must be inside the SD card root — {value}':
    '{label}: Der Pfad muss innerhalb des Stammordners der SD-Karte liegen – {value}',
  'An operation is in progress: “{operation}”': 'Ein Vorgang läuft gerade: „{operation}“',
  'The application will close as soon as it finishes.': 'Die App wird geschlossen, sobald er abgeschlossen ist.',
  'Close when finished': 'Nach Abschluss schließen',
  'Keep working': 'Weiterarbeiten',
  'The short name cannot be empty': 'Der Kurzname darf nicht leer sein',
  'The short name is too long (128 characters maximum)': 'Der Kurzname ist zu lang (maximal 128 Zeichen)',
  'The short name cannot contain spaces': 'Der Kurzname darf keine Leerzeichen enthalten',
  'A tag cannot contain a space — a space separates the tags: “{tag}”':
    'Ein Tag darf kein Leerzeichen enthalten – Leerzeichen trennen die Tags: „{tag}“',
  'A tag is too long (the maximum is {max} characters): “{tag}”': 'Ein Tag ist zu lang (maximal {max} Zeichen): „{tag}“',
  'Too many tags (no more than {max})': 'Zu viele Tags (höchstens {max})',
  'Nothing to change': 'Nichts zu ändern',
  'editing a game': 'Spiel bearbeiten',
  'Game data changed in the CSV: “{rel}” (backup: {csvBackupPath})': 'Spieldaten in der CSV geändert: „{rel}“ (Backup: {csvBackupPath})',
  tags: 'Tags',
  'The CSV has no column for the game title — choose it in the settings':
    'Die CSV hat keine Spalte für den Spieltitel – wähle sie in den Einstellungen',
  'The CSV has no column for the short name — choose it in the settings':
    'Die CSV hat keine Spalte für den Kurznamen – wähle sie in den Einstellungen',
  'The CSV has no column for the tags — choose it in the settings':
    'Die CSV hat keine Spalte für die Tags – wähle sie in den Einstellungen',
  'Image conversion is unavailable: the "sharp" module could not be loaded ({message})':
    'Die Bildkonvertierung ist nicht verfügbar: Das Modul „sharp“ ließ sich nicht laden ({message})',
  'The image could not be read or converted to PNG: {message}': 'Das Bild ließ sich nicht lesen oder in PNG umwandeln: {message}',
  'changing a cover': 'Cover ändern',
  'The old cover was removed: {file}': 'Das alte Cover wurde entfernt: {file}',
  'The old cover could not be removed: {file} ({message})': 'Das alte Cover ließ sich nicht entfernen: {file} ({message})',
  'Cover saved as PNG for the game “{rel}”: {imagePath}': 'Cover als PNG gespeichert für das Spiel „{rel}“: {imagePath}',
  'The file “{name}” is too large for a .{ext}': 'Die Datei „{name}“ ist zu groß für eine .{ext}',
  'Only the parts of one disc image can be selected together: .bin + .cue, .ccd + .img + .sub, or their .ecm archives':
    'Zusammen lassen sich nur die Teile eines einzigen Disc-Images auswählen: .bin + .cue, .ccd + .img + .sub oder deren .ecm-Archive',
  'Several .ccd files selected. Add one game at a time: one .ccd with its .img and .sub.':
    'Mehrere .ccd-Dateien ausgewählt. Füge immer nur ein Spiel hinzu: eine .ccd mit ihrer .img und .sub.',
  'The disc image set is incomplete. Missing: {files}. An .img or .bin may also be selected as an .ecm archive.':
    'Das Disc-Image ist unvollständig. Es fehlt: {files}. Statt einer .img oder .bin kannst du auch ein .ecm-Archiv auswählen.',
  'The files {files} hold the same data — select only one of them':
    'Die Dateien {files} enthalten dieselben Daten – wähle nur eine davon aus',
  'The files {files} do not belong to this disc image — remove them from the selection':
    'Die Dateien {files} gehören nicht zu diesem Disc-Image – entferne sie aus der Auswahl',
  'The ECM archive “{name}” is empty': 'Das ECM-Archiv „{name}“ ist leer',
  'The size of “{fileName}” is not a multiple of the CD sector size ({sector} bytes): the image is corrupted':
    'Die Größe von „{fileName}“ ist kein Vielfaches der CD-Sektorgröße ({sector} Bytes): Das Image ist beschädigt',
  '“{name}” is not a CloneCD control file (no [CloneCD] section)': '„{name}“ ist keine CloneCD-Steuerdatei (kein Abschnitt [CloneCD])',
  'The size of “{name}” does not match the image: the subchannel data may be wrong':
    'Die Größe von „{name}“ passt nicht zum Image: Die Subchannel-Daten sind möglicherweise falsch',
  ' (image from a CloneCD set)': ' (Image aus einem CloneCD-Set)',
  ' (unpacked from ECM)': ' (aus ECM entpackt)',
  'Not enough free space: {need} MB is needed, {free} MB is available':
    'Nicht genug freier Speicherplatz: {need} MB werden benötigt, {free} MB sind verfügbar',
  'The ECM archive “{name}” is damaged: {reason}': 'Das ECM-Archiv „{name}“ ist beschädigt: {reason}',
  'the file ends too early': 'die Datei endet zu früh',
  'invalid record header': 'ungültiger Datensatz-Header',
  'this is not an ECM file (no ECM header)': 'das ist keine ECM-Datei (kein ECM-Header)',
  'the checksum of the unpacked data does not match': 'die Prüfsumme der entpackten Daten stimmt nicht',
  'The image “{taken}” is already in the images folder — it is used as the cover':
    'Das Bild „{taken}“ liegt bereits im Bilderordner – es wird als Cover verwendet',
  'Cover could not be created: {message}': 'Das Cover ließ sich nicht erstellen: {message}',
  '; generated cover: {v0}': '; erzeugtes Cover: {v0}',
  'The generated cover could not be redrawn with the new title: {message}':
    'Das erzeugte Cover ließ sich nicht mit dem neuen Titel neu zeichnen: {message}',
  'The CSV file was created: {csvPath}': 'Die CSV-Datei wurde angelegt: {csvPath}',
  'The tags column was added to {count} CSV row(s)': 'Die Tags-Spalte wurde hinzugefügt (CSV-Zeilen: {count})',
  'Old backups moved from the card to the computer: {count} (folder: {dir})':
    'Alte Backups von der Karte auf den Computer verschoben: {count} (Ordner: {dir})',
  'Leftovers of interrupted writes removed from the card: {count}': 'Reste unterbrochener Schreibvorgänge von der Karte entfernt: {count}',
  'No file manager was found to open the folder: {dir}': 'Es wurde kein Dateimanager gefunden, um den Ordner zu öffnen: {dir}',
  'The folder could not be opened: {dir} ({message})': 'Der Ordner ließ sich nicht öffnen: {dir} ({message})',
  Emulator: 'Emulator',
  'Emulator: the path does not exist — {path}': 'Emulator: Der Pfad existiert nicht – {path}',
  Applications: 'Anwendungen',
  Programs: 'Programme',
  'The emulator chosen in the settings was not found: {path}': 'Der in den Einstellungen gewählte Emulator wurde nicht gefunden: {path}',
  '{emulator} is not installed': '{emulator} ist nicht installiert',
  'The platform of the game is unknown: choose the platform folder on the SD card':
    'Die Plattform des Spiels ist unbekannt: Wähle den Plattformordner auf der SD-Karte',
  '{emulator} does not support {platform}': '{emulator} unterstützt {platform} nicht',
  '{emulator} cannot open .{ext} files of {platform}. Supported: {formats}':
    '{emulator} kann .{ext}-Dateien für {platform} nicht öffnen. Unterstützt: {formats}',
  'Support for .{ext} files is coming in a future release.': 'Unterstützung für .{ext}-Dateien kommt in einer künftigen Version.',
  'No RetroArch core for {platform} is installed. Install one of: {cores} (RetroArch: Main Menu → Load Core → Download a Core)':
    'Es ist kein RetroArch-Core für {platform} installiert. Installiere einen davon: {cores} (RetroArch: Main Menu → Load Core → Download a Core)',
  'Games can be started in an emulator only in the desktop application': 'Spiele lassen sich nur in der Desktop-App im Emulator starten',
  '{emulator} could not be started: {message}': '{emulator} ließ sich nicht starten: {message}',
  'Started in {emulator}: {rel}': 'In {emulator} gestartet: {rel}',
  'The title cannot contain the “|” character': 'Der Titel darf das Zeichen „|“ nicht enthalten',
  'The short name cannot contain the “|” character': 'Der Kurzname darf das Zeichen „|“ nicht enthalten',
  'The title or short name of “{path}” contains “{separator}” — its line in {name} is not written':
    'Der Titel oder Kurzname von „{path}“ enthält „{separator}“ – die Zeile in {name} wird nicht geschrieben',
  'Console lists updated: {lists}': 'Konsolenlisten aktualisiert: {lists}',
  'The console lists (.lst) could not be updated: {message}': 'Die Konsolenlisten (.lst) ließen sich nicht aktualisieren: {message}',
  '{name} does not read correctly as {encoding} — it was not changed, so that it is not damaged':
    '{name} lässt sich als {encoding} nicht fehlerfrei lesen – die Datei wurde nicht geändert, damit sie nicht beschädigt wird',
  '{name}: the new lines cannot be written in its encoding ({encoding}) — it was not changed':
    '{name}: Die neuen Zeilen lassen sich in ihrer Kodierung ({encoding}) nicht schreiben – die Datei wurde nicht geändert',
  'Console list created (UTF-8): {lists}': 'Konsolenliste erstellt (UTF-8): {lists}',
  'The previously selected SD card is not available ({reason}), its selection was reset: {root}':
    'Die zuvor gewählte SD-Karte ist nicht verfügbar ({reason}), ihre Auswahl wurde zurückgesetzt: {root}',
  'the path was not found': 'der Pfad wurde nicht gefunden',
  'no permission to read it': 'keine Leseberechtigung',
  'no permission to write to it': 'keine Schreibberechtigung',
  'no answer within {seconds} s': 'keine Antwort innerhalb von {seconds} s',
  '{folder} is a media folder, not a game folder: no games or filelist.csv are added there':
    '{folder} ist ein Medienordner, kein Spieleordner: Dort werden keine Spiele und keine filelist.csv hinzugefügt',
  'The title can contain only English letters, digits, spaces and the signs - _ ( ) [ ] . & # :':
    'Der Titel darf nur englische Buchstaben, Ziffern, Leerzeichen und die Zeichen - _ ( ) [ ] . & # : enthalten',
  'The short name can contain only English letters, digits and the signs - _ ( ) [ ] . & # :':
    'Der Kurzname darf nur englische Buchstaben, Ziffern und die Zeichen - _ ( ) [ ] . & # : enthalten',
};
