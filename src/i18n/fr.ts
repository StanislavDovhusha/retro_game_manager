// French translations of server messages. The key is the English source text.
export const fr: Readonly<Record<string, string>> = {
  'SD card root': 'Racine de la carte SD',
  'Games folder': 'Dossier des jeux',
  'Images folder: this is a file, not a folder — {imagesDir}': 'Dossier des images : c’est un fichier, pas un dossier — {imagesDir}',
  'CSV file: the path is not a file — {csvPath}': 'Fichier CSV : le chemin n’est pas un fichier — {csvPath}',
  'CSV file folder': 'Dossier du fichier CSV',
  'Invalid CSV delimiter': 'Séparateur CSV non valide',
  'Invalid CSV encoding': 'Encodage CSV non valide',
  'Column {v0}': 'Colonne {v0}',
  'Could not read the CSV file: {message}': 'Impossible de lire le fichier CSV : {message}',
  'The CSV could not be parsed (check the delimiter and encoding): {message}':
    'Impossible d’analyser le CSV (vérifie le séparateur et l’encodage) : {message}',
  'Could not create a CSV backup; the file was not changed: {message}':
    'Impossible de créer une copie de sauvegarde du CSV ; le fichier n’a pas été modifié : {message}',
  'Could not save the CSV (the original file is untouched, backup: {v0}): {message}':
    'Impossible d’enregistrer le CSV (le fichier d’origine est intact, copie de sauvegarde : {v0}) : {message}',
  'not needed': 'pas nécessaire',
  'The CSV has no columns — check the file structure in the settings':
    'Le CSV n’a aucune colonne : vérifie la structure du fichier dans les paramètres',
  'Column “{name}” ({label}) was not found in the CSV': 'La colonne « {name} » ({label}) est introuvable dans le CSV',
  'file path': 'chemin du fichier',
  'game title': 'titre du jeu',
  'short name': 'nom court',
  'the result size ({size}) does not match the expected size ({expectedSize})':
    'la taille du résultat ({size}) ne correspond pas à la taille attendue ({expectedSize})',
  'CSV and text files': 'Fichiers CSV et texte',
  'All files': 'Tous les fichiers',
  Images: 'Images',
  'Choose a folder': 'Choisis un dossier',
  Games: 'Jeux',
  'Unknown file type': 'Type de fichier inconnu',
  'Choose files': 'Choisis des fichiers',
  'Choose a file': 'Choisis un fichier',
  'The system dialog is unavailable (install zenity or kdialog). Enter the path manually.':
    'La boîte de dialogue du système est indisponible (installe zenity ou kdialog). Saisis le chemin à la main.',
  'Could not open the system dialog: {message}': 'Impossible d’ouvrir la boîte de dialogue du système : {message}',
  'The .cue refers to a file of type {type}: only .bin images (BINARY) are supported':
    'Le .cue fait référence à un fichier de type {type} : seules les images .bin (BINARY) sont prises en charge',
  'The .cue has a TRACK line before FILE — the file is corrupted': 'Le .cue contient une ligne TRACK avant FILE : le fichier est corrompu',
  'The .cue uses an unsupported track mode: {mode}': 'Le .cue utilise un mode de piste non pris en charge : {mode}',
  'The tracks in “{name}” have different sector sizes — such an image is not supported':
    'Les pistes de « {name} » ont des tailles de secteur différentes : ce type d’image n’est pas pris en charge',
  'The .cue has no FILE lines — this is not a cue file': 'Le .cue ne contient aucune ligne FILE : ce n’est pas un fichier cue',
  'No TRACK is specified in the .cue for the file “{name}”': 'Aucun TRACK n’est indiqué dans le .cue pour le fichier « {name} »',
  'Selected .bin files have identical names': 'Les fichiers .bin sélectionnés portent le même nom',
  'The file “{name}” is listed several times in the .cue': 'Le fichier « {name} » est indiqué plusieurs fois dans le .cue',
  'The .cue refers to the file “{name}”, but it is not selected. Select it together with the .cue.':
    'Le .cue fait référence au fichier « {name} », mais il n’est pas sélectionné. Sélectionne-le avec le .cue.',
  'The file “{fileName}” is not listed in the .cue — remove it from the selection.':
    'Le fichier « {fileName} » ne figure pas dans le .cue : retire-le de la sélection.',
  'The SD card root is not selected': 'La racine de la carte SD n’est pas sélectionnée',
  'System folders of the console cannot be modified: {p}': 'Les dossiers système de la console ne peuvent pas être modifiés : {p}',
  'Platform “{name}” was not found on the memory card': 'La plateforme « {name} » est introuvable sur la carte mémoire',
  'The path goes outside the folder': 'Le chemin sort du dossier',
  'Folder not found': 'Dossier introuvable',
  'Request from a disallowed origin': 'Requête provenant d’une origine non autorisée',
  'application/json is expected': 'application/json est attendu',
  'API method not found': 'Méthode d’API introuvable',
  'Invalid JSON': 'JSON non valide',
  'No access to the file or folder: {v0}': 'Pas d’accès au fichier ou au dossier : {v0}',
  'Internal server error': 'Erreur interne du serveur',
  'Could not prepare the uploads folder:': 'Impossible de préparer le dossier des envois :',
  'Retro Game Manager: API at http://{HOST}:{PORT}': 'Retro Game Manager : API sur http://{HOST}:{PORT}',
  ' (the UI is built — open this address)': ' (l’interface est compilée : ouvre cette adresse)',
  ' (development mode: the UI is at http://localhost:5173)': ' (mode développement : l’interface est sur http://localhost:5173)',
  'Server started': 'Serveur démarré',
  'Games folder: {gamesDir}': 'Dossier des jeux : {gamesDir}',
  'CSV file: {csvPath}': 'Fichier CSV : {csvPath}',
  'Images folder: {v0}': 'Dossier des images : {v0}',
  'SD card root: {root}': 'Racine de la carte SD : {root}',
  'Console model recognized by the card: {name}': 'Modèle de console reconnu d’après la carte : {name}',
  'Platform {name}: games — {gamesDir}, images — {imagesDir}, CSV — {csvPath}':
    'Plateforme {name} : jeux — {gamesDir}, images — {imagesDir}, CSV — {csvPath}',
  'Deletion requires confirmation': 'La suppression doit être confirmée',
  'Image not found': 'Image introuvable',
  'Cleaning the CSV requires confirmation': 'Le nettoyage du CSV doit être confirmé',
  'No files selected': 'Aucun fichier sélectionné',
  'Invalid file name': 'Nom de fichier non valide',
  'File name not specified': 'Nom de fichier non indiqué',
  'Sync requires confirmation': 'La synchronisation doit être confirmée',
  'Not enough disk space': 'Espace disque insuffisant',
  'No access: {what}': 'Pas d’accès : {what}',
  'The folder is read-only: {what}': 'Le dossier est en lecture seule : {what}',
  'Supported images: PNG, JPG, JPEG, WEBP (also BMP, GIF)': 'Images prises en charge : PNG, JPG, JPEG, WEBP (ainsi que BMP, GIF)',
  'Choose a game file (an image does not fit here)': 'Choisis un fichier de jeu (une image ne convient pas ici)',
  'The .{ext} extension is not in the list of game extensions ({v1}). Add it in “Settings → Extensions”.':
    'L’extension .{ext} ne figure pas dans la liste des extensions de jeu ({v1}). Ajoute-la dans « Paramètres → Extensions ».',
  'No file selected': 'Aucun fichier sélectionné',
  'File not found: {name}': 'Fichier introuvable : {name}',
  'file “{name}”': 'fichier « {name} »',
  '“{name}” is not a file': '« {name} » n’est pas un fichier',
  'The file “{name}” is empty': 'Le fichier « {name} » est vide',
  'A game file name cannot be built from this title — change the title':
    'Impossible de former un nom de fichier de jeu à partir de ce titre : modifie-le',
  'Too many files (no more than {MAX_FILES})': 'Trop de fichiers ({MAX_FILES} au maximum)',
  'Several .bin files need a .cue file that describes the tracks':
    'Plusieurs fichiers .bin ont besoin d’un fichier .cue qui décrit les pistes',
  'Several .cue files selected. Add one game at a time: one .cue and its .bin files.':
    'Plusieurs fichiers .cue sélectionnés. Ajoute un jeu à la fois : un .cue et ses fichiers .bin.',
  'No .bin is selected for “{fileName}”. You need to select: {v1}':
    'Aucun .bin n’est sélectionné pour « {fileName} ». Il faut sélectionner : {v1}',
  'Tracks with different sector sizes cannot be merged into one .img':
    'Des pistes de tailles de secteur différentes ne peuvent pas être fusionnées en un seul .img',
  'The size of “{fileName}” is not a multiple of the sector size ({sector} bytes): the file is corrupted or does not match the .cue':
    'La taille de « {fileName} » n’est pas un multiple de la taille de secteur ({sector} octets) : le fichier est corrompu ou ne correspond pas au .cue',
  'The .cue has {tracks} tracks. Track boundaries are not preserved in a single .img':
    'Le .cue contient {tracks} pistes. Les limites des pistes ne sont pas conservées dans un seul .img',
  ', and audio tracks (CDDA) may not play.': ', et les pistes audio (CDDA) risquent de ne pas être lues.',
  'adding a game': 'ajout d’un jeu',
  'The game title cannot be empty': 'Le titre du jeu ne peut pas être vide',
  'The game title is too long (200 characters maximum)': 'Le titre du jeu est trop long (200 caractères maximum)',
  'The title contains invalid characters': 'Le titre contient des caractères non valides',
  'The title needs at least one letter or digit': 'Le titre doit contenir au moins une lettre ou un chiffre',
  'Choose the games folder first': 'Choisis d’abord le dossier des jeux',
  'Choose the CSV file first': 'Choisis d’abord le fichier CSV',
  'games folder {gamesDir}': 'dossier des jeux {gamesDir}',
  'reading the games folder': 'lecture du dossier des jeux',
  'The game is already added: the file “{fileName}” exists in the games folder':
    'Le jeu est déjà ajouté : le fichier « {fileName} » existe dans le dossier des jeux',
  'A game titled “{cleanTitle}” is already in the CSV ({key}). Change the title.':
    'Un jeu intitulé « {cleanTitle} » figure déjà dans le CSV ({key}). Modifie le titre.',
  'An image file name cannot be built from this title — change the title':
    'Impossible de former un nom de fichier d’image à partir de ce titre : modifie-le',
  'reading the images folder': 'lecture du dossier des images',
  'The image “{taken}” already exists in the images folder. Change the title or delete the old image.':
    'L’image « {taken} » existe déjà dans le dossier des images. Modifie le titre ou supprime l’ancienne image.',
  'Game “{cleanTitle}” was not added: {message}': 'Le jeu « {cleanTitle} » n’a pas été ajouté : {message}',
  'could not copy the file': 'impossible de copier le fichier',
  'The .{ext} extension was added to the list of game files': 'L’extension .{ext} a été ajoutée à la liste des fichiers de jeu',
  'Could not add .{ext} to the extensions list ({message}) — add it in “Settings → Extensions”.':
    'Impossible d’ajouter .{ext} à la liste des extensions ({message}) : ajoute-la dans « Paramètres → Extensions ».',
  'Games of the {platform} platform cannot be compressed to .zip':
    'Les jeux de la plateforme {platform} ne peuvent pas être compressés en .zip',
  'The game file is larger than 4 GB and cannot be compressed to .zip':
    'Le fichier du jeu dépasse 4 Go et ne peut pas être compressé en .zip',
  ' (compressed to .zip, inside: {name})': ' (compressé en .zip, contenu : {name})',
  'Game added “{cleanTitle}”: {dest}': 'Jeu ajouté « {cleanTitle} » : {dest}',
  ' (image built from {length} .bin/.cue file(s))': ' (image créée à partir de {length} fichier(s) .bin/.cue)',
  '; image: {v0}': ' ; image : {v0}',
  ' (CSV entry updated)': ' (entrée CSV mise à jour)',
  'No CSV file selected': 'Aucun fichier CSV sélectionné',
  'editing the CSV': 'modification du CSV',
  'CSV edited manually: {length} rows (backup: {backupPath})':
    'CSV modifié à la main : {length} lignes (copie de sauvegarde : {backupPath})',
  'cleaning the CSV': 'nettoyage du CSV',
  'The folder contents have changed: there are now {length} missing entries instead of {expected}. Run the check again.':
    'Le contenu du dossier a changé : il y a maintenant {length} entrées manquantes au lieu de {expected}. Relance la vérification.',
  'CSV cleanup: entries for missing games removed — {length} (backup: {backupPath})':
    'Nettoyage du CSV : entrées de jeux manquants supprimées — {length} (copie de sauvegarde : {backupPath})',
  'deleting games': 'suppression de jeux',
  'No games selected for deletion': 'Aucun jeu sélectionné pour la suppression',
  'The games folder is not selected': 'Le dossier des jeux n’est pas sélectionné',
  'Only files can be deleted': 'Seuls des fichiers peuvent être supprimés',
  'No access to the file': 'Pas d’accès au fichier',
  'Could not delete “{rel}”: {error}': 'Impossible de supprimer « {rel} » : {error}',
  'Deleting games: deleted {length}, already missing {length1}, errors {length2}':
    'Suppression de jeux : {length} supprimés, {length1} déjà absents, {length2} erreurs',
  'Game file deleted: {r}': 'Fichier de jeu supprimé : {r}',
  'CSV is not configured': 'Le CSV n’est pas configuré',
  'The CSV file has not been created yet': 'Le fichier CSV n’a pas encore été créé',
  'Entries removed from the CSV: {removed} (backup: {backupPath})':
    'Entrées supprimées du CSV : {removed} (copie de sauvegarde : {backupPath})',
  'No entries for these games were found in the CSV': 'Aucune entrée pour ces jeux n’a été trouvée dans le CSV',
  'The files were deleted, but the CSV was not updated: {message}':
    'Les fichiers ont été supprimés, mais le CSV n’a pas été mis à jour : {message}',
  'File not found — it may have already been deleted': 'Fichier introuvable : il a peut-être déjà été supprimé',
  'This game has no image': 'Ce jeu n’a pas d’image',
  'The image is outside the selected folder': 'L’image se trouve hors du dossier sélectionné',
  'Image deleted: {imageAbs}': 'Image supprimée : {imageAbs}',
  'An image outside the selected folders is not deleted from disk; only the link was removed: {imageAbs}':
    'Une image située hors des dossiers sélectionnés n’est pas supprimée du disque ; seul le lien a été retiré : {imageAbs}',
  Image: 'Image',
  'Supported formats: png, jpg, jpeg, bmp, gif, webp': 'Formats pris en charge : png, jpg, jpeg, bmp, gif, webp',
  'The folder is unavailable or has been deleted': 'Le dossier est indisponible ou a été supprimé',
  'Scan: games found — {games}, folders — {length} ({durationMs} ms)':
    'Analyse : jeux trouvés — {games}, dossiers — {length} ({durationMs} ms)',
  'Could not read “{path}”: {message}': 'Impossible de lire « {path} » : {message}',
  'Choose the CSV file in the settings first': 'Choisis d’abord le fichier CSV dans les paramètres',
  'Some folders cannot be read, sync stopped: {path} — {message}':
    'Certains dossiers ne peuvent pas être lus, synchronisation interrompue : {path} — {message}',
  'CSV sync': 'synchronisation du CSV',
  'CSV sync: started': 'Synchronisation du CSV : démarrée',
  'Sync finished: added {toAdd}, removed {toRemove}, unchanged {unchanged}':
    'Synchronisation terminée : {toAdd} ajoutés, {toRemove} supprimés, {unchanged} inchangés',
  '; backup: {backupPath}': ' ; copie de sauvegarde : {backupPath}',
  '; the CSV was not changed': ' ; le CSV n’a pas été modifié',
  'Sync failed: {message}': 'Échec de la synchronisation : {message}',
  'Not enough disk space to upload the file': 'Espace disque insuffisant pour envoyer le fichier',
  'Upload interrupted: {message}': 'Envoi interrompu : {message}',
  'The file is empty': 'Le fichier est vide',
  'The uploaded file has expired — choose it again': 'Le fichier envoyé a expiré : choisis-le à nouveau',
  'The operation “{busy}” is in progress. Wait for it to finish.': 'L’opération « {busy} » est en cours. Attends qu’elle se termine.',
  'No folder selected': 'Aucun dossier sélectionné',
  'Invalid file path': 'Chemin de fichier non valide',
  'File not found': 'Fichier introuvable',
  'The file is outside the selected folder': 'Le fichier se trouve hors du dossier sélectionné',
  '{label}: folder not found or unavailable — {p}': '{label} : dossier introuvable ou indisponible — {p}',
  '{label}: file not found or unavailable — {p}': '{label} : fichier introuvable ou indisponible — {p}',
  'Only a game file can be renamed': 'Seul un fichier de jeu peut être renommé',
  'A file name cannot be made from this title — change the title':
    'Impossible de former un nom de fichier à partir de ce titre : modifie-le',
  'Two files would get the same name: {to}': 'Deux fichiers porteraient le même nom : {to}',
  'The file already exists: {to}': 'Le fichier existe déjà : {to}',
  'The cover is outside the games and images folders — its name is not changed: {imageAbs}':
    'La jaquette se trouve hors des dossiers des jeux et des images : son nom n’est pas modifié : {imageAbs}',
  'There is no entry for this game in the CSV — the CSV will not change':
    'Il n’y a aucune entrée pour ce jeu dans le CSV : le CSV ne changera pas',
  'The CSV file does not exist yet — the CSV will not change': 'Le fichier CSV n’existe pas encore : le CSV ne changera pas',
  'Select a platform on the SD card — then saves and lists in {folder} will be updated':
    'Sélectionne une plateforme sur la carte SD : les sauvegardes et les listes dans {folder} seront alors mises à jour',
  'The {folder} folder was not found on the card — saves and lists are left untouched':
    'Le dossier {folder} est introuvable sur la carte : les sauvegardes et les listes ne sont pas touchées',
  'Could not read {name}: {message}': 'Impossible de lire {name} : {message}',
  'The file {name} is not UTF-8 text or is binary — skipped': 'Le fichier {name} n’est pas du texte UTF-8 ou est binaire : ignoré',
  'Nothing would change: the title and file name are already like this':
    'Rien ne changerait : le titre et le nom du fichier sont déjà ceux-là',
  'renaming a game': 'renommage d’un jeu',
  'Renaming “{rel}” failed, changes were rolled back: {message}':
    'Le renommage de « {rel} » a échoué, les modifications ont été annulées : {message}',
  'Could not rename: {message}': 'Impossible de renommer : {message}',
  'The game was renamed, but the manually chosen cover was not carried over: {message}':
    'Le jeu a été renommé, mais la jaquette choisie manuellement n’a pas été reprise : {message}',
  'Game renamed: “{from}” → “{to}” (files: {n}, lists and bindings: {m})':
    'Jeu renommé : « {from} » → « {to} » (fichiers : {n}, listes et associations : {m})',
  'Renaming requires confirmation': 'Le renommage doit être confirmé',
  'The request body is too large': 'Le corps de la requête est trop volumineux',
  'Invalid request': 'Requête non valide',
  File: 'Fichier',
  'This BMP variant is not supported: {detail}': 'Cette variante de BMP n’est pas prise en charge : {detail}',
  'The BMP file is damaged or incomplete': 'Le fichier BMP est endommagé ou incomplet',
  'The picture is too large': 'L’image est trop grande',
  'The file is not a valid image (PNG, JPG, WEBP, BMP or GIF)': 'Le fichier n’est pas une image valide (PNG, JPG, WEBP, BMP ou GIF)',
  'Images folder': 'Dossier des images',
  'CSV file': 'Fichier CSV',
  'The file is too large (at most {max} MB)': 'Le fichier est trop volumineux ({max} Mo au maximum)',
  '{label}: an absolute path is required': '{label} : un chemin absolu est requis',
  '{label}: the path must be inside the SD card root — {value}':
    '{label} : le chemin doit se trouver dans la racine de la carte SD — {value}',
  'An operation is in progress: “{operation}”': 'Une opération est en cours : « {operation} »',
  'The application will close as soon as it finishes.': 'L’application se fermera dès qu’elle sera terminée.',
  'Close when finished': 'Fermer une fois terminé',
  'Keep working': 'Continuer à travailler',
  'The short name cannot be empty': 'Le nom court ne peut pas être vide',
  'The short name is too long (128 characters maximum)': 'Le nom court est trop long (128 caractères maximum)',
  'The short name cannot contain spaces': 'Le nom court ne peut pas contenir d’espaces',
  'A tag cannot contain a space — a space separates the tags: “{tag}”':
    'Un tag ne peut pas contenir d’espace, car l’espace sépare les tags : « {tag} »',
  'A tag is too long (the maximum is {max} characters): “{tag}”': 'Un tag est trop long ({max} caractères au maximum) : « {tag} »',
  'Too many tags (no more than {max})': 'Trop de tags ({max} au maximum)',
  'Nothing to change': 'Rien à modifier',
  'editing a game': 'modification d’un jeu',
  'Game data changed in the CSV: “{rel}” (backup: {csvBackupPath})':
    'Données du jeu modifiées dans le CSV : « {rel} » (copie de sauvegarde : {csvBackupPath})',
  tags: 'tags',
  'The CSV has no column for the game title — choose it in the settings':
    'Le CSV n’a pas de colonne pour le titre du jeu : choisis-la dans les paramètres',
  'The CSV has no column for the short name — choose it in the settings':
    'Le CSV n’a pas de colonne pour le nom court : choisis-la dans les paramètres',
  'The CSV has no column for the tags — choose it in the settings':
    'Le CSV n’a pas de colonne pour les tags : choisis-la dans les paramètres',
  'Image conversion is unavailable: the "sharp" module could not be loaded ({message})':
    'La conversion d’images est indisponible : le module « sharp » n’a pas pu être chargé ({message})',
  'The image could not be read or converted to PNG: {message}': 'Impossible de lire l’image ou de la convertir en PNG : {message}',
  'changing a cover': 'changement de jaquette',
  'The old cover was removed: {file}': 'L’ancienne jaquette a été supprimée : {file}',
  'The old cover could not be removed: {file} ({message})': 'Impossible de supprimer l’ancienne jaquette : {file} ({message})',
  'Cover saved as PNG for the game “{rel}”: {imagePath}': 'Jaquette enregistrée en PNG pour le jeu « {rel} » : {imagePath}',
  'The file “{name}” is too large for a .{ext}': 'Le fichier « {name} » est trop volumineux pour un .{ext}',
  'Only the parts of one disc image can be selected together: .bin + .cue, .ccd + .img + .sub, or their .ecm archives':
    'Seules les parties d’une même image disque peuvent être sélectionnées ensemble : .bin + .cue, .ccd + .img + .sub, ou leurs archives .ecm',
  'Several .ccd files selected. Add one game at a time: one .ccd with its .img and .sub.':
    'Plusieurs fichiers .ccd sélectionnés. Ajoute un jeu à la fois : un .ccd avec son .img et son .sub.',
  'The disc image set is incomplete. Missing: {files}. An .img or .bin may also be selected as an .ecm archive.':
    'L’image disque est incomplète. Il manque : {files}. Un .img ou un .bin peut aussi être sélectionné sous forme d’archive .ecm.',
  'The files {files} hold the same data — select only one of them':
    'Les fichiers {files} contiennent les mêmes données : n’en sélectionne qu’un',
  'The files {files} do not belong to this disc image — remove them from the selection':
    'Les fichiers {files} n’appartiennent pas à cette image disque : retire-les de la sélection',
  'The ECM archive “{name}” is empty': 'L’archive ECM « {name} » est vide',
  'The size of “{fileName}” is not a multiple of the CD sector size ({sector} bytes): the image is corrupted':
    'La taille de « {fileName} » n’est pas un multiple de la taille de secteur d’un CD ({sector} octets) : l’image est corrompue',
  '“{name}” is not a CloneCD control file (no [CloneCD] section)':
    '« {name} » n’est pas un fichier de contrôle CloneCD (pas de section [CloneCD])',
  'The size of “{name}” does not match the image: the subchannel data may be wrong':
    'La taille de « {name} » ne correspond pas à l’image : les données de sous-canal sont peut-être incorrectes',
  ' (image from a CloneCD set)': ' (image issue d’un ensemble CloneCD)',
  ' (unpacked from ECM)': ' (décompressé depuis l’ECM)',
  'Not enough free space: {need} MB is needed, {free} MB is available':
    'Espace libre insuffisant : {need} Mo sont nécessaires, {free} Mo sont disponibles',
  'The ECM archive “{name}” is damaged: {reason}': 'L’archive ECM « {name} » est endommagée : {reason}',
  'the file ends too early': 'le fichier se termine trop tôt',
  'invalid record header': 'en-tête d’enregistrement non valide',
  'this is not an ECM file (no ECM header)': 'ce n’est pas un fichier ECM (pas d’en-tête ECM)',
  'the checksum of the unpacked data does not match': 'la somme de contrôle des données décompressées ne correspond pas',
  'The image “{taken}” is already in the images folder — it is used as the cover':
    'L’image « {taken} » se trouve déjà dans le dossier des images : elle sert de jaquette',
  'Cover could not be created: {message}': 'Impossible de créer la jaquette : {message}',
  '; generated cover: {v0}': ' ; jaquette générée : {v0}',
  'The generated cover could not be redrawn with the new title: {message}':
    'Impossible de redessiner la jaquette générée avec le nouveau titre : {message}',
  'The CSV file was created: {csvPath}': 'Le fichier CSV a été créé : {csvPath}',
  'The tags column was added to {count} CSV row(s)': 'La colonne de tags a été ajoutée (lignes du CSV : {count})',
  'Old backups moved from the card to the computer: {count} (folder: {dir})':
    'Anciennes copies de sauvegarde déplacées de la carte vers l’ordinateur : {count} (dossier : {dir})',
  'Leftovers of interrupted writes removed from the card: {count}': 'Restes d’écritures interrompues supprimés de la carte : {count}',
  'No file manager was found to open the folder: {dir}': 'Aucun gestionnaire de fichiers trouvé pour ouvrir le dossier : {dir}',
  'The folder could not be opened: {dir} ({message})': 'Impossible d’ouvrir le dossier : {dir} ({message})',
  Emulator: 'Émulateur',
  'Emulator: the path does not exist — {path}': 'Émulateur : le chemin n’existe pas — {path}',
  Applications: 'Applications',
  Programs: 'Programmes',
  'The emulator chosen in the settings was not found: {path}': 'L’émulateur choisi dans les paramètres est introuvable : {path}',
  '{emulator} is not installed': '{emulator} n’est pas installé',
  'The platform of the game is unknown: choose the platform folder on the SD card':
    'La plateforme du jeu est inconnue : choisis le dossier de la plateforme sur la carte SD',
  '{emulator} does not support {platform}': '{emulator} ne prend pas en charge {platform}',
  '{emulator} cannot open .{ext} files of {platform}. Supported: {formats}':
    '{emulator} ne peut pas ouvrir les fichiers .{ext} de {platform}. Pris en charge : {formats}',
  'Support for .{ext} files is coming in a future release.': 'La prise en charge des fichiers .{ext} arrivera dans une prochaine version.',
  'No RetroArch core for {platform} is installed. Install one of: {cores} (RetroArch: Main Menu → Load Core → Download a Core)':
    'Aucun cœur RetroArch n’est installé pour {platform}. Installe l’un de ceux-ci : {cores} (RetroArch : Main Menu → Load Core → Download a Core)',
  'Games can be started in an emulator only in the desktop application':
    'Les jeux ne peuvent être lancés dans un émulateur que depuis l’application de bureau',
  '{emulator} could not be started: {message}': 'Impossible de lancer {emulator} : {message}',
  'Started in {emulator}: {rel}': 'Lancé dans {emulator} : {rel}',
  'The title cannot contain the “|” character': 'Le titre ne peut pas contenir le caractère « | »',
  'The short name cannot contain the “|” character': 'Le nom court ne peut pas contenir le caractère « | »',
  'The title or short name of “{path}” contains “{separator}” — its line in {name} is not written':
    'Le titre ou le nom court de « {path} » contient « {separator} » : sa ligne dans {name} n’est pas écrite',
  'Console lists updated: {lists}': 'Listes de la console mises à jour : {lists}',
  'The console lists (.lst) could not be updated: {message}': 'Impossible de mettre à jour les listes de la console (.lst) : {message}',
  '{name} does not read correctly as {encoding} — it was not changed, so that it is not damaged':
    '{name} ne se lit pas correctement en {encoding} : il n’a pas été modifié, pour ne pas l’abîmer',
  '{name}: the new lines cannot be written in its encoding ({encoding}) — it was not changed':
    '{name} : les nouvelles lignes ne peuvent pas être écrites dans son encodage ({encoding}), il n’a donc pas été modifié',
  'Console list created (UTF-8): {lists}': 'Liste de la console créée (UTF-8) : {lists}',
  'The previously selected SD card is not available ({reason}), its selection was reset: {root}':
    'La carte SD choisie précédemment n’est pas disponible ({reason}), sa sélection a été réinitialisée : {root}',
  'the path was not found': 'le chemin est introuvable',
  'no permission to read it': 'pas d’autorisation de lecture',
  'no permission to write to it': 'pas d’autorisation d’écriture',
  'no answer within {seconds} s': 'pas de réponse en {seconds} s',
  '{folder} is a media folder, not a game folder: no games or filelist.csv are added there':
    '{folder} est un dossier multimédia, pas un dossier de jeux : aucun jeu ni filelist.csv n’y est ajouté',
  'The title can contain only English letters, digits, spaces and the signs - _ ( ) [ ] . & # :':
    'Le titre ne peut contenir que des lettres anglaises, des chiffres, des espaces et les signes - _ ( ) [ ] . & # :',
  'The short name can contain only English letters, digits and the signs - _ ( ) [ ] . & # :':
    'Le nom court ne peut contenir que des lettres anglaises, des chiffres et les signes - _ ( ) [ ] . & # :',
};
