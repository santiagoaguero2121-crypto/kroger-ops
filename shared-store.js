// shared-store.js
// -----------------------------------------------------------------
// Almacenamiento compartido de archivos (ITN, WO, Facturación) entre
// todos los módulos de DK Floral Ops (Comparador Kroger, Seguimiento
// Diario ITN, Análisis WO, Logística, etc.)
//
// Cómo funciona:
//  - Cuando subes un archivo en CUALQUIER módulo, además de procesarlo
//    normalmente, se guarda una copia en localStorage (mismo origen =
//    mismo storage para todas las páginas del sitio).
//  - Cuando abres OTRO módulo, este script revisa si ya existe un
//    archivo guardado y lo carga automáticamente, sin que tengas que
//    volver a subirlo.
//
// Para usarlo en un módulo:
//   1. Agrega <script src="shared-store.js"></script> DESPUÉS del
//      script de xlsx.full.min.js y ANTES del <script> del módulo.
//   2. Al leer un archivo (FileReader -> ArrayBuffer), llama:
//        DKShared.save('itn', {name:file.name}, arrayBuffer);
//      (usa la clave 'itn', 'wo' o 'fac' según corresponda)
//   3. Al iniciar la página, llama:
//        var s = DKShared.get('itn');
//        if(s){ /* procesa s.arrayBuffer igual que un archivo subido, usando s.name */ }
// -----------------------------------------------------------------
(function (window) {
  var PREFIX = 'dk_shared_file_';
  var META_SUFFIX = '_meta';

  function arrayBufferToBase64(buffer) {
    var binary = '';
    var bytes = new Uint8Array(buffer);
    var chunk = 0x8000;
    for (var i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
    }
    return window.btoa(binary);
  }

  function base64ToArrayBuffer(base64) {
    var binary = window.atob(base64);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // Guarda un archivo (por tipo: 'itn' | 'wo' | 'fac') para que otros
  // módulos puedan leerlo automáticamente.
  function saveSharedFile(type, fileMeta, arrayBuffer) {
    try {
      var b64 = arrayBufferToBase64(arrayBuffer);
      localStorage.setItem(PREFIX + type, b64);
      var meta = {
        name: (fileMeta && fileMeta.name) || ('archivo_' + type),
        savedAt: new Date().toISOString(),
      };
      // Fecha explícita (YYYY-MM-DD) que representa el archivo, si se indicó.
      // Se usa para que los módulos que llevan historial por día (p.ej.
      // Seguimiento ITN) no tengan que "adivinar" la fecha del archivo.
      if (fileMeta && fileMeta.date) meta.date = fileMeta.date;
      localStorage.setItem(PREFIX + type + META_SUFFIX, JSON.stringify(meta));
      return true;
    } catch (e) {
      console.warn('DKShared: no se pudo guardar el archivo compartido "' + type + '"', e);
      return false;
    }
  }

  // Recupera el archivo compartido más reciente de un tipo, o null si no existe.
  function getSharedFile(type) {
    try {
      var b64 = localStorage.getItem(PREFIX + type);
      if (!b64) return null;
      var metaRaw = localStorage.getItem(PREFIX + type + META_SUFFIX);
      var meta = metaRaw ? JSON.parse(metaRaw) : { name: 'archivo_' + type };
      return {
        name: meta.name,
        savedAt: meta.savedAt,
        date: meta.date || null,
        arrayBuffer: base64ToArrayBuffer(b64),
      };
    } catch (e) {
      console.warn('DKShared: no se pudo leer el archivo compartido "' + type + '"', e);
      return null;
    }
  }

  function hasSharedFile(type) {
    return !!localStorage.getItem(PREFIX + type);
  }

  function clearSharedFile(type) {
    localStorage.removeItem(PREFIX + type);
    localStorage.removeItem(PREFIX + type + META_SUFFIX);
  }

  // Avisa en tiempo real cuando otro módulo (otra pestaña, otro iframe,
  // u otra ventana del mismo sitio) guarda un archivo nuevo de este tipo.
  // No requiere recargar la página. callback(s) recibe lo mismo que get().
  function onSharedChange(type, callback) {
    window.addEventListener('storage', function (e) {
      if (e.key !== PREFIX + type) return;
      var s = getSharedFile(type);
      if (s) callback(s);
    });
  }

  window.DKShared = {
    save: saveSharedFile,
    get: getSharedFile,
    has: hasSharedFile,
    clear: clearSharedFile,
    onChange: onSharedChange,
  };
})(window);
