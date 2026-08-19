# belmont girl slop

Primera versión de una experiencia 3D de escritorio para explorar el universo audiovisual de belmont girl.

## Desarrollo

```powershell
npm install
npm run dev
```

Abre la URL local que indique Vite. El ejemplo de configuración usa el bucket público de R2:

```powershell
Copy-Item .env.example .env.local
npm run dev
```

`VITE_VIDEO_BASE_URL` determina el origen de los vídeos. Para volver al modo de archivos locales, deja esa variable vacía y configura `BELMONTGIRL_VIDEO_DIR` con una carpeta de vídeos de tu equipo. Esa carpeta se expone únicamente a través del servidor local y nunca se copia al repositorio.

La carpeta no se incluye en este repositorio.

Los vídeos no se copian al repositorio. El catálogo estático está en `src/data/catalog.js` y cada entrada contiene `fileName`, `id`, `title`, `thumbnail` y `youtubeUrl`. Actualmente incluye las 143 entradas locales; los 142 vídeos con ID de YouTube tienen su título guardado como metadato estático y `belmontgirl_completo` permanece como vídeo local sin enlace externo. Los títulos se muestran en minúsculas para respetar el estilo del canal.

Las paletas visuales preanalizadas se guardan como metadatos derivados en `src/data/video-palettes.js`. La primera entrada corresponde a `kathy's song` y contiene cuatro colores cada ocho segundos; la aplicación interpola entre muestras durante la reproducción, sin leer el vídeo desde un canvas del navegador.

Para regenerar las paletas de todo el catálogo usando los vídeos locales, configura `BELMONTGIRL_VIDEO_DIR` o pasa la ruta mediante `--video-dir`:

```powershell
npm run generate:palettes
npm run generate:palettes -- --video-dir="C:/ruta/a/belmontgirl_videos"
```

El procesamiento normal omite `belmontgirl_completo.mp4`, que es una compilación local de varias horas y no tiene ID de YouTube. Para incluir entradas locales sin enlace externo de forma explícita, añade `--include-local-only`.

Durante una prueba se puede procesar un único vídeo en un archivo aparte:

```powershell
npm run generate:palettes -- --only=c42Qr_j980g --output=.temp-kathy-palettes.js
```

## Controles

- `WASD` o flechas: volar en relación con la dirección de la cámara.
- `Espacio` / `E`: ascender. `Alt` / `Q`: descender.
- Arrastrar con el ratón: orientar la cámara hacia los lados y verticalmente.
- Rueda del ratón: acercar o alejar la cámara del avatar; al acercarse mucho, transita suavemente a primera persona.
- `Menú`: seleccionar escenario, avatar y vídeo.
- El menú muestra todas las entradas del catálogo y permite filtrarlas por texto contenido en el título, ID o nombre de archivo.
- La pantalla inicial activa la reproducción con sonido.
- Al terminar un vídeo, comienza automáticamente otro elegido al azar.

## Escenarios

La primera versión incluye esfera envolvente, cielo, playa, espacio luminoso, cubo envolvente y cilindro envolvente. La esfera, el cubo y el cilindro incluyen partículas flotantes; en el cubo y el cilindro se distribuyen dentro de sus límites geométricos. El estado de escena, vídeo y avatar se mantiene separado para poder ampliar la experiencia más adelante sin implementar todavía multijugador, WebSockets, cuentas, chat ni soporte móvil.
