// Spanish translations of server messages. The key is the English source text.
export const es: Readonly<Record<string, string>> = {
  'SD card root': 'Raíz de la tarjeta SD',
  'Games folder': 'Carpeta de juegos',
  'Images folder: this is a file, not a folder — {imagesDir}': 'Carpeta de imágenes: es un archivo, no una carpeta — {imagesDir}',
  'CSV file: the path is not a file — {csvPath}': 'Archivo CSV: la ruta no es un archivo — {csvPath}',
  'CSV file folder': 'Carpeta del archivo CSV',
  'Invalid CSV delimiter': 'Delimitador de CSV no válido',
  'Invalid CSV encoding': 'Codificación de CSV no válida',
  'Column {v0}': 'Columna {v0}',
  'Could not read the CSV file: {message}': 'No se ha podido leer el archivo CSV: {message}',
  'The CSV could not be parsed (check the delimiter and encoding): {message}':
    'No se ha podido interpretar el CSV (revisa el delimitador y la codificación): {message}',
  'Could not create a CSV backup; the file was not changed: {message}':
    'No se ha podido crear la copia de seguridad del CSV; el archivo no se ha modificado: {message}',
  'Could not save the CSV (the original file is untouched, backup: {v0}): {message}':
    'No se ha podido guardar el CSV (el archivo original está intacto, copia de seguridad: {v0}): {message}',
  'not needed': 'no ha hecho falta',
  'The CSV has no columns — check the file structure in the settings':
    'El CSV no tiene columnas: revisa la estructura del archivo en los ajustes',
  'Column “{name}” ({label}) was not found in the CSV': 'No se ha encontrado la columna «{name}» ({label}) en el CSV',
  'file path': 'ruta del archivo',
  'game title': 'título del juego',
  'short name': 'nombre corto',
  'the result size ({size}) does not match the expected size ({expectedSize})':
    'el tamaño del resultado ({size}) no coincide con el esperado ({expectedSize})',
  'CSV and text files': 'Archivos CSV y de texto',
  'All files': 'Todos los archivos',
  Images: 'Imágenes',
  'Choose a folder': 'Elige una carpeta',
  Games: 'Juegos',
  'Unknown file type': 'Tipo de archivo desconocido',
  'Choose files': 'Elige archivos',
  'Choose a file': 'Elige un archivo',
  'The system dialog is unavailable (install zenity or kdialog). Enter the path manually.':
    'El diálogo del sistema no está disponible (instala zenity o kdialog). Escribe la ruta a mano.',
  'Could not open the system dialog: {message}': 'No se ha podido abrir el diálogo del sistema: {message}',
  'The .cue refers to a file of type {type}: only .bin images (BINARY) are supported':
    'El .cue hace referencia a un archivo de tipo {type}: solo se admiten imágenes .bin (BINARY)',
  'The .cue has a TRACK line before FILE — the file is corrupted': 'El .cue tiene una línea TRACK antes de FILE: el archivo está dañado',
  'The .cue uses an unsupported track mode: {mode}': 'El .cue usa un modo de pista no compatible: {mode}',
  'The tracks in “{name}” have different sector sizes — such an image is not supported':
    'Las pistas de «{name}» tienen tamaños de sector distintos: este tipo de imagen no es compatible',
  'The .cue has no FILE lines — this is not a cue file': 'El .cue no tiene líneas FILE: no es un archivo cue',
  'No TRACK is specified in the .cue for the file “{name}”': 'El .cue no indica ningún TRACK para el archivo «{name}»',
  'Selected .bin files have identical names': 'Los archivos .bin seleccionados tienen nombres idénticos',
  'The file “{name}” is listed several times in the .cue': 'El archivo «{name}» aparece varias veces en el .cue',
  'The .cue refers to the file “{name}”, but it is not selected. Select it together with the .cue.':
    'El .cue hace referencia al archivo «{name}», pero no está seleccionado. Selecciónalo junto con el .cue.',
  'The file “{fileName}” is not listed in the .cue — remove it from the selection.':
    'El archivo «{fileName}» no aparece en el .cue: quítalo de la selección.',
  'The SD card root is not selected': 'No se ha seleccionado la raíz de la tarjeta SD',
  'System folders of the console cannot be modified: {p}': 'Las carpetas del sistema de la consola no se pueden modificar: {p}',
  'Platform “{name}” was not found on the memory card': 'No se ha encontrado la plataforma «{name}» en la tarjeta de memoria',
  'The path goes outside the folder': 'La ruta sale de la carpeta',
  'Folder not found': 'Carpeta no encontrada',
  'Request from a disallowed origin': 'Solicitud desde un origen no permitido',
  'application/json is expected': 'Se esperaba application/json',
  'API method not found': 'Método de la API no encontrado',
  'Invalid JSON': 'JSON no válido',
  'No access to the file or folder: {v0}': 'Sin acceso al archivo o a la carpeta: {v0}',
  'Internal server error': 'Error interno del servidor',
  'Could not prepare the uploads folder:': 'No se ha podido preparar la carpeta de subidas:',
  'Retro Game Manager: API at http://{HOST}:{PORT}': 'Retro Game Manager: API en http://{HOST}:{PORT}',
  ' (the UI is built — open this address)': ' (la interfaz está compilada: abre esta dirección)',
  ' (development mode: the UI is at http://localhost:5173)': ' (modo de desarrollo: la interfaz está en http://localhost:5173)',
  'Server started': 'Servidor iniciado',
  'Games folder: {gamesDir}': 'Carpeta de juegos: {gamesDir}',
  'CSV file: {csvPath}': 'Archivo CSV: {csvPath}',
  'Images folder: {v0}': 'Carpeta de imágenes: {v0}',
  'SD card root: {root}': 'Raíz de la tarjeta SD: {root}',
  'Console model recognized by the card: {name}': 'Modelo de consola reconocido por la tarjeta: {name}',
  'Platform {name}: games — {gamesDir}, images — {imagesDir}, CSV — {csvPath}':
    'Plataforma {name}: juegos — {gamesDir}, imágenes — {imagesDir}, CSV — {csvPath}',
  'Deletion requires confirmation': 'La eliminación requiere confirmación',
  'Image not found': 'Imagen no encontrada',
  'Cleaning the CSV requires confirmation': 'La limpieza del CSV requiere confirmación',
  'No files selected': 'No se han seleccionado archivos',
  'Invalid file name': 'Nombre de archivo no válido',
  'File name not specified': 'No se ha indicado el nombre del archivo',
  'Sync requires confirmation': 'La sincronización requiere confirmación',
  'Not enough disk space': 'No hay suficiente espacio en disco',
  'No access: {what}': 'Sin acceso: {what}',
  'The folder is read-only: {what}': 'La carpeta es de solo lectura: {what}',
  'Supported images: PNG, JPG, JPEG, WEBP (also BMP, GIF)': 'Imágenes compatibles: PNG, JPG, JPEG, WEBP (también BMP, GIF)',
  'Choose a game file (an image does not fit here)': 'Elige un archivo de juego (aquí no va una imagen)',
  'The .{ext} extension is not in the list of game extensions ({v1}). Add it in “Settings → Extensions”.':
    'La extensión .{ext} no está en la lista de extensiones de juego ({v1}). Añádela en «Ajustes → Extensiones».',
  'No file selected': 'No se ha seleccionado ningún archivo',
  'File not found: {name}': 'Archivo no encontrado: {name}',
  'file “{name}”': 'archivo «{name}»',
  '“{name}” is not a file': '«{name}» no es un archivo',
  'The file “{name}” is empty': 'El archivo «{name}» está vacío',
  'A game file name cannot be built from this title — change the title':
    'No se puede crear un nombre de archivo de juego a partir de este título: cámbialo',
  'Too many files (no more than {MAX_FILES})': 'Demasiados archivos (máximo {MAX_FILES})',
  'Several .bin files need a .cue file that describes the tracks': 'Varios archivos .bin necesitan un archivo .cue que describa las pistas',
  'Several .cue files selected. Add one game at a time: one .cue and its .bin files.':
    'Has seleccionado varios archivos .cue. Añade los juegos de uno en uno: un .cue y sus archivos .bin.',
  'No .bin is selected for “{fileName}”. You need to select: {v1}':
    'No se ha seleccionado ningún .bin para «{fileName}». Hay que seleccionar: {v1}',
  'Tracks with different sector sizes cannot be merged into one .img':
    'Las pistas con tamaños de sector distintos no se pueden unir en un único .img',
  'The size of “{fileName}” is not a multiple of the sector size ({sector} bytes): the file is corrupted or does not match the .cue':
    'El tamaño de «{fileName}» no es múltiplo del tamaño de sector ({sector} bytes): el archivo está dañado o no corresponde al .cue',
  'The .cue has {tracks} tracks. Track boundaries are not preserved in a single .img':
    'El .cue tiene {tracks} pistas. Los límites de las pistas no se conservan en un único .img',
  ', and audio tracks (CDDA) may not play.': ', y puede que las pistas de audio (CDDA) no se reproduzcan.',
  'adding a game': 'añadir un juego',
  'The game title cannot be empty': 'El título del juego no puede estar vacío',
  'The game title is too long (200 characters maximum)': 'El título del juego es demasiado largo (máximo 200 caracteres)',
  'The title contains invalid characters': 'El título contiene caracteres no válidos',
  'The title needs at least one letter or digit': 'El título necesita al menos una letra o un número',
  'Choose the games folder first': 'Primero elige la carpeta de juegos',
  'Choose the CSV file first': 'Primero elige el archivo CSV',
  'games folder {gamesDir}': 'carpeta de juegos {gamesDir}',
  'reading the games folder': 'lectura de la carpeta de juegos',
  'The game is already added: the file “{fileName}” exists in the games folder':
    'El juego ya está añadido: el archivo «{fileName}» existe en la carpeta de juegos',
  'A game titled “{cleanTitle}” is already in the CSV ({key}). Change the title.':
    'Ya hay un juego titulado «{cleanTitle}» en el CSV ({key}). Cambia el título.',
  'An image file name cannot be built from this title — change the title':
    'No se puede crear un nombre de archivo de imagen a partir de este título: cámbialo',
  'reading the images folder': 'lectura de la carpeta de imágenes',
  'The image “{taken}” already exists in the images folder. Change the title or delete the old image.':
    'La imagen «{taken}» ya existe en la carpeta de imágenes. Cambia el título o elimina la imagen antigua.',
  'Game “{cleanTitle}” was not added: {message}': 'El juego «{cleanTitle}» no se ha añadido: {message}',
  'could not copy the file': 'no se ha podido copiar el archivo',
  'The .{ext} extension was added to the list of game files': 'La extensión .{ext} se ha añadido a la lista de archivos de juego',
  'Could not add .{ext} to the extensions list ({message}) — add it in “Settings → Extensions”.':
    'No se ha podido añadir .{ext} a la lista de extensiones ({message}): añádela en «Ajustes → Extensiones».',
  'Games of the {platform} platform cannot be compressed to .zip': 'Los juegos de la plataforma {platform} no se pueden comprimir en .zip',
  'The game file is larger than 4 GB and cannot be compressed to .zip':
    'El archivo del juego ocupa más de 4 GB y no se puede comprimir en .zip',
  ' (compressed to .zip, inside: {name})': ' (comprimido en .zip, dentro: {name})',
  'Game added “{cleanTitle}”: {dest}': 'Juego añadido «{cleanTitle}»: {dest}',
  ' (image built from {length} .bin/.cue file(s))': ' (imagen creada a partir de {length} archivo(s) .bin/.cue)',
  '; image: {v0}': '; imagen: {v0}',
  ' (CSV entry updated)': ' (entrada del CSV actualizada)',
  'No CSV file selected': 'No se ha seleccionado ningún archivo CSV',
  'editing the CSV': 'editar el CSV',
  'CSV edited manually: {length} rows (backup: {backupPath})': 'CSV editado a mano: {length} filas (copia de seguridad: {backupPath})',
  'cleaning the CSV': 'limpiar el CSV',
  'The folder contents have changed: there are now {length} missing entries instead of {expected}. Run the check again.':
    'El contenido de la carpeta ha cambiado: ahora faltan {length} entradas en lugar de {expected}. Repite la comprobación.',
  'CSV cleanup: entries for missing games removed — {length} (backup: {backupPath})':
    'Limpieza del CSV: entradas de juegos que faltan eliminadas — {length} (copia de seguridad: {backupPath})',
  'deleting games': 'eliminar juegos',
  'No games selected for deletion': 'No se han seleccionado juegos para eliminar',
  'The games folder is not selected': 'No se ha seleccionado la carpeta de juegos',
  'Only files can be deleted': 'Solo se pueden eliminar archivos',
  'No access to the file': 'Sin acceso al archivo',
  'Could not delete “{rel}”: {error}': 'No se ha podido eliminar «{rel}»: {error}',
  'Deleting games: deleted {length}, already missing {length1}, errors {length2}':
    'Eliminación de juegos: eliminados {length}, ya no existían {length1}, errores {length2}',
  'Game file deleted: {r}': 'Archivo de juego eliminado: {r}',
  'CSV is not configured': 'El CSV no está configurado',
  'The CSV file has not been created yet': 'El archivo CSV todavía no se ha creado',
  'Entries removed from the CSV: {removed} (backup: {backupPath})':
    'Entradas eliminadas del CSV: {removed} (copia de seguridad: {backupPath})',
  'No entries for these games were found in the CSV': 'No se han encontrado entradas de estos juegos en el CSV',
  'The files were deleted, but the CSV was not updated: {message}':
    'Los archivos se han eliminado, pero el CSV no se ha actualizado: {message}',
  'File not found — it may have already been deleted': 'Archivo no encontrado: puede que ya se haya eliminado',
  'This game has no image': 'Este juego no tiene imagen',
  'The image is outside the selected folder': 'La imagen está fuera de la carpeta seleccionada',
  'Image deleted: {imageAbs}': 'Imagen eliminada: {imageAbs}',
  'An image outside the selected folders is not deleted from disk; only the link was removed: {imageAbs}':
    'Una imagen que está fuera de las carpetas seleccionadas no se elimina del disco; solo se ha quitado el vínculo: {imageAbs}',
  Image: 'Imagen',
  'Supported formats: png, jpg, jpeg, bmp, gif, webp': 'Formatos compatibles: png, jpg, jpeg, bmp, gif, webp',
  'The folder is unavailable or has been deleted': 'La carpeta no está disponible o se ha eliminado',
  'Scan: games found — {games}, folders — {length} ({durationMs} ms)':
    'Escaneo: juegos encontrados — {games}, carpetas — {length} ({durationMs} ms)',
  'Could not read “{path}”: {message}': 'No se ha podido leer «{path}»: {message}',
  'Choose the CSV file in the settings first': 'Primero elige el archivo CSV en los ajustes',
  'Some folders cannot be read, sync stopped: {path} — {message}':
    'Algunas carpetas no se pueden leer, sincronización detenida: {path} — {message}',
  'CSV sync': 'sincronización del CSV',
  'CSV sync: started': 'Sincronización del CSV: iniciada',
  'Sync finished: added {toAdd}, removed {toRemove}, unchanged {unchanged}':
    'Sincronización terminada: añadidos {toAdd}, eliminados {toRemove}, sin cambios {unchanged}',
  '; backup: {backupPath}': '; copia de seguridad: {backupPath}',
  '; the CSV was not changed': '; el CSV no ha cambiado',
  'Sync failed: {message}': 'La sincronización ha fallado: {message}',
  'Not enough disk space to upload the file': 'No hay suficiente espacio en disco para subir el archivo',
  'Upload interrupted: {message}': 'Subida interrumpida: {message}',
  'The file is empty': 'El archivo está vacío',
  'The uploaded file has expired — choose it again': 'El archivo subido ha caducado: elígelo de nuevo',
  'The operation “{busy}” is in progress. Wait for it to finish.': 'La operación «{busy}» está en curso. Espera a que termine.',
  'No folder selected': 'No se ha seleccionado ninguna carpeta',
  'Invalid file path': 'Ruta de archivo no válida',
  'File not found': 'Archivo no encontrado',
  'The file is outside the selected folder': 'El archivo está fuera de la carpeta seleccionada',
  '{label}: folder not found or unavailable — {p}': '{label}: carpeta no encontrada o no disponible — {p}',
  '{label}: file not found or unavailable — {p}': '{label}: archivo no encontrado o no disponible — {p}',
  'Only a game file can be renamed': 'Solo se puede renombrar un archivo de juego',
  'A file name cannot be made from this title — change the title':
    'No se puede crear un nombre de archivo a partir de este título: cámbialo',
  'Two files would get the same name: {to}': 'Dos archivos tendrían el mismo nombre: {to}',
  'The file already exists: {to}': 'El archivo ya existe: {to}',
  'The cover is outside the games and images folders — its name is not changed: {imageAbs}':
    'La carátula está fuera de las carpetas de juegos e imágenes: su nombre no se cambia: {imageAbs}',
  'There is no entry for this game in the CSV — the CSV will not change':
    'No hay ninguna entrada de este juego en el CSV: el CSV no cambiará',
  'The CSV file does not exist yet — the CSV will not change': 'El archivo CSV todavía no existe: el CSV no cambiará',
  'Select a platform on the SD card — then saves and lists in {folder} will be updated':
    'Selecciona una plataforma en la tarjeta SD: así se actualizarán las partidas guardadas y las listas de {folder}',
  'The {folder} folder was not found on the card — saves and lists are left untouched':
    'No se ha encontrado la carpeta {folder} en la tarjeta: las partidas guardadas y las listas no se tocan',
  'Could not read {name}: {message}': 'No se ha podido leer {name}: {message}',
  'The file {name} is not UTF-8 text or is binary — skipped': 'El archivo {name} no es texto UTF-8 o es binario: omitido',
  'Nothing would change: the title and file name are already like this': 'No cambiaría nada: el título y el nombre del archivo ya son así',
  'renaming a game': 'renombrar un juego',
  'Renaming “{rel}” failed, changes were rolled back: {message}':
    'No se ha podido renombrar «{rel}»; los cambios se han deshecho: {message}',
  'Could not rename: {message}': 'No se ha podido renombrar: {message}',
  'The game was renamed, but the manually chosen cover was not carried over: {message}':
    'El juego se ha renombrado, pero la carátula elegida manualmente no se ha conservado: {message}',
  'Game renamed: “{from}” → “{to}” (files: {n}, lists and bindings: {m})':
    'Juego renombrado: «{from}» → «{to}» (archivos: {n}, listas y asignaciones: {m})',
  'Renaming requires confirmation': 'El cambio de nombre requiere confirmación',
  'The request body is too large': 'El cuerpo de la solicitud es demasiado grande',
  'Invalid request': 'Solicitud no válida',
  File: 'Archivo',
  'This BMP variant is not supported: {detail}': 'Esta variante de BMP no es compatible: {detail}',
  'The BMP file is damaged or incomplete': 'El archivo BMP está dañado o incompleto',
  'The picture is too large': 'La imagen es demasiado grande',
  'The file is not a valid image (PNG, JPG, WEBP, BMP or GIF)': 'El archivo no es una imagen válida (PNG, JPG, WEBP, BMP o GIF)',
  'Images folder': 'Carpeta de imágenes',
  'CSV file': 'Archivo CSV',
  'The file is too large (at most {max} MB)': 'El archivo es demasiado grande (máximo {max} MB)',
  '{label}: an absolute path is required': '{label}: se necesita una ruta absoluta',
  '{label}: the path must be inside the SD card root — {value}': '{label}: la ruta debe estar dentro de la raíz de la tarjeta SD — {value}',
  'An operation is in progress: “{operation}”': 'Hay una operación en curso: «{operation}»',
  'The application will close as soon as it finishes.': 'La aplicación se cerrará en cuanto termine.',
  'Close when finished': 'Cerrar al terminar',
  'Keep working': 'Seguir trabajando',
  'The short name cannot be empty': 'El nombre corto no puede estar vacío',
  'The short name is too long (128 characters maximum)': 'El nombre corto es demasiado largo (máximo 128 caracteres)',
  'The short name cannot contain spaces': 'El nombre corto no puede contener espacios',
  'A tag cannot contain a space — a space separates the tags: “{tag}”':
    'Una etiqueta no puede contener espacios, porque el espacio separa las etiquetas: «{tag}»',
  'A tag is too long (the maximum is {max} characters): “{tag}”': 'Una etiqueta es demasiado larga (máximo {max} caracteres): «{tag}»',
  'Too many tags (no more than {max})': 'Demasiadas etiquetas (máximo {max})',
  'Nothing to change': 'No hay nada que cambiar',
  'editing a game': 'editar un juego',
  'Game data changed in the CSV: “{rel}” (backup: {csvBackupPath})':
    'Datos del juego modificados en el CSV: «{rel}» (copia de seguridad: {csvBackupPath})',
  tags: 'etiquetas',
  'The CSV has no column for the game title — choose it in the settings':
    'El CSV no tiene ninguna columna para el título del juego: elígela en los ajustes',
  'The CSV has no column for the short name — choose it in the settings':
    'El CSV no tiene ninguna columna para el nombre corto: elígela en los ajustes',
  'The CSV has no column for the tags — choose it in the settings':
    'El CSV no tiene ninguna columna para las etiquetas: elígela en los ajustes',
  'Image conversion is unavailable: the "sharp" module could not be loaded ({message})':
    'La conversión de imágenes no está disponible: no se ha podido cargar el módulo «sharp» ({message})',
  'The image could not be read or converted to PNG: {message}': 'No se ha podido leer la imagen o convertirla a PNG: {message}',
  'changing a cover': 'cambiar una carátula',
  'The old cover was removed: {file}': 'Se ha eliminado la carátula antigua: {file}',
  'The old cover could not be removed: {file} ({message})': 'No se ha podido eliminar la carátula antigua: {file} ({message})',
  'Cover saved as PNG for the game “{rel}”: {imagePath}': 'Carátula guardada como PNG para el juego «{rel}»: {imagePath}',
  'The file “{name}” is too large for a .{ext}': 'El archivo «{name}» es demasiado grande para ser un .{ext}',
  'Only the parts of one disc image can be selected together: .bin + .cue, .ccd + .img + .sub, or their .ecm archives':
    'Solo se pueden seleccionar juntas las partes de una misma imagen de disco: .bin + .cue, .ccd + .img + .sub o sus archivos .ecm',
  'Several .ccd files selected. Add one game at a time: one .ccd with its .img and .sub.':
    'Has seleccionado varios archivos .ccd. Añade los juegos de uno en uno: un .ccd con su .img y su .sub.',
  'The disc image set is incomplete. Missing: {files}. An .img or .bin may also be selected as an .ecm archive.':
    'El conjunto de la imagen de disco está incompleto. Falta: {files}. En lugar de un .img o un .bin también puedes seleccionar un archivo .ecm.',
  'The files {files} hold the same data — select only one of them': 'Los archivos {files} contienen los mismos datos: selecciona solo uno',
  'The files {files} do not belong to this disc image — remove them from the selection':
    'Los archivos {files} no pertenecen a esta imagen de disco: quítalos de la selección',
  'The ECM archive “{name}” is empty': 'El archivo ECM «{name}» está vacío',
  'The size of “{fileName}” is not a multiple of the CD sector size ({sector} bytes): the image is corrupted':
    'El tamaño de «{fileName}» no es múltiplo del tamaño de sector de CD ({sector} bytes): la imagen está dañada',
  '“{name}” is not a CloneCD control file (no [CloneCD] section)':
    '«{name}» no es un archivo de control de CloneCD (no tiene la sección [CloneCD])',
  'The size of “{name}” does not match the image: the subchannel data may be wrong':
    'El tamaño de «{name}» no coincide con la imagen: puede que los datos de subcanal sean incorrectos',
  ' (image from a CloneCD set)': ' (imagen a partir de un conjunto CloneCD)',
  ' (unpacked from ECM)': ' (descomprimido de ECM)',
  'Not enough free space: {need} MB is needed, {free} MB is available':
    'No hay suficiente espacio libre: se necesitan {need} MB y hay {free} MB disponibles',
  'The ECM archive “{name}” is damaged: {reason}': 'El archivo ECM «{name}» está dañado: {reason}',
  'the file ends too early': 'el archivo termina antes de tiempo',
  'invalid record header': 'cabecera de registro no válida',
  'this is not an ECM file (no ECM header)': 'no es un archivo ECM (no tiene cabecera ECM)',
  'the checksum of the unpacked data does not match': 'la suma de comprobación de los datos descomprimidos no coincide',
  'The image “{taken}” is already in the images folder — it is used as the cover':
    'La imagen «{taken}» ya está en la carpeta de imágenes: se usa como carátula',
  'Cover could not be created: {message}': 'No se ha podido crear la carátula: {message}',
  '; generated cover: {v0}': '; carátula generada: {v0}',
  'The generated cover could not be redrawn with the new title: {message}':
    'No se ha podido redibujar la carátula generada con el nuevo título: {message}',
  'The CSV file was created: {csvPath}': 'Se ha creado el archivo CSV: {csvPath}',
  'The tags column was added to {count} CSV row(s)': 'Se ha añadido la columna de etiquetas (filas del CSV: {count})',
  'Old backups moved from the card to the computer: {count} (folder: {dir})':
    'Copias de seguridad antiguas movidas de la tarjeta al ordenador: {count} (carpeta: {dir})',
  'Leftovers of interrupted writes removed from the card: {count}': 'Restos de escrituras interrumpidas eliminados de la tarjeta: {count}',
  'No file manager was found to open the folder: {dir}': 'No se ha encontrado ningún gestor de archivos para abrir la carpeta: {dir}',
  'The folder could not be opened: {dir} ({message})': 'No se ha podido abrir la carpeta: {dir} ({message})',
  Emulator: 'Emulador',
  'Emulator: the path does not exist — {path}': 'Emulador: la ruta no existe — {path}',
  Applications: 'Aplicaciones',
  Programs: 'Programas',
  'The emulator chosen in the settings was not found: {path}': 'No se ha encontrado el emulador elegido en los ajustes: {path}',
  '{emulator} is not installed': '{emulator} no está instalado',
  'The platform of the game is unknown: choose the platform folder on the SD card':
    'No se conoce la plataforma del juego: elige la carpeta de la plataforma en la tarjeta SD',
  '{emulator} does not support {platform}': '{emulator} no es compatible con {platform}',
  '{emulator} cannot open .{ext} files of {platform}. Supported: {formats}':
    '{emulator} no puede abrir archivos .{ext} de {platform}. Compatibles: {formats}',
  'Support for .{ext} files is coming in a future release.': 'La compatibilidad con archivos .{ext} llegará en una versión futura.',
  'No RetroArch core for {platform} is installed. Install one of: {cores} (RetroArch: Main Menu → Load Core → Download a Core)':
    'No hay ningún núcleo de RetroArch instalado para {platform}. Instala uno de estos: {cores} (RetroArch: Main Menu → Load Core → Download a Core)',
  'Games can be started in an emulator only in the desktop application':
    'Los juegos solo se pueden iniciar en un emulador desde la aplicación de escritorio',
  '{emulator} could not be started: {message}': 'No se ha podido iniciar {emulator}: {message}',
  'Started in {emulator}: {rel}': 'Iniciado en {emulator}: {rel}',
  'The title cannot contain the “|” character': 'El título no puede contener el carácter «|»',
  'The short name cannot contain the “|” character': 'El nombre corto no puede contener el carácter «|»',
  'The title or short name of “{path}” contains “{separator}” — its line in {name} is not written':
    'El título o el nombre corto de «{path}» contiene «{separator}»: su línea en {name} no se escribe',
  'Console lists updated: {lists}': 'Listas de la consola actualizadas: {lists}',
  'The console lists (.lst) could not be updated: {message}': 'No se han podido actualizar las listas de la consola (.lst): {message}',
  '{name} does not read correctly as {encoding} — it was not changed, so that it is not damaged':
    '{name} no se lee correctamente como {encoding}: no se ha modificado para no dañarlo',
  '{name}: the new lines cannot be written in its encoding ({encoding}) — it was not changed':
    '{name}: las nuevas líneas no se pueden escribir en su codificación ({encoding}); no se ha modificado',
  'Console list created (UTF-8): {lists}': 'Lista de la consola creada (UTF-8): {lists}',
  'The previously selected SD card is not available ({reason}), its selection was reset: {root}':
    'La tarjeta SD seleccionada anteriormente no está disponible ({reason}); se ha restablecido su selección: {root}',
  'the path was not found': 'no se encontró la ruta',
  'no permission to read it': 'sin permiso de lectura',
  'no permission to write to it': 'sin permiso de escritura',
  'no answer within {seconds} s': 'sin respuesta en {seconds} s',
  '{folder} is a media folder, not a game folder: no games or filelist.csv are added there':
    '{folder} es una carpeta multimedia, no de juegos: no se añaden juegos ni filelist.csv en ella',
  'The title can contain only English letters, digits, spaces and the signs - _ ( ) [ ] . & # :':
    'El título solo puede contener letras inglesas, cifras, espacios y los signos - _ ( ) [ ] . & # :',
  'The short name can contain only English letters, digits and the signs - _ ( ) [ ] . & # :':
    'El nombre corto solo puede contener letras inglesas, cifras y los signos - _ ( ) [ ] . & # :',
};
