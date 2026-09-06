# Nubes volumétricas del amanecer

Implementación WebGL compatible con Three.js 0.176.0. No requiere plugins ni migración a WebGPU.

## Guía utilizada

- [Ejemplo volumétrico oficial de Three.js](https://github.com/mrdoob/three.js/blob/dev/examples/webgl_volume_cloud.html): textura tridimensional, intervalos de intersección y acumulación de opacidad.
- [Takram Clouds](https://github.com/takram-design-engineering/three-geospatial/tree/main/packages/clouds): separación de cobertura, forma y erosión; iluminación y compromisos de calidad.
- [Guerrilla: The Real-Time Volumetric Cloudscapes of Horizon Zero Dawn](https://www.guerrilla-games.com/read/the-real-time-volumetric-cloudscapes-of-horizon-zero-dawn): referencia de objetivos visuales. Se consultó la presentación general de la publicación, no sus diapositivas completas.
- [Guía comunitaria de nubes para Three.js](https://github.com/linegel/threejs-complete-set-of-skill/blob/main/skills/threejs-volumetric-clouds/SKILL.md): continuidad espacial, escalas de densidad y validación. Consultada como documentación, no instalada; sus instrucciones específicas de WebGPU no se aplican aquí.

## Arquitectura

- `CloudNoise.js`: atlas periódico Perlin-Worley RGBA de 96³, generado en CPU una vez y reutilizado. Cada instancia posee su textura GPU.
- `VolumetricClouds.js`: capa esférica entre 1500 y 2250 unidades sobre el nivel de referencia. Cobertura amplia, masas a escala intermedia y erosión fina; el viento desplaza el campo tridimensional.
- La absorción sigue Beer-Lambert tanto para la cámara como para el Sol. La iluminación combina una fase de dispersión de dos lóbulos, atenuación hacia el Sol y luz ambiente aproximada.
- `DawnAtmosphere.js`: color de fondo compartido entre cielo y bruma de las nubes para evitar un horizonte de distinto color.
- `DawnSky.js`: compone radiancia y opacidad premultiplicadas. El disco solar y su halo se mantienen separados.
- La cámara principal tiene un pase propio de nubes. Las reflexiones utilizan una captura cúbica más económica: no se amplía esa captura de baja resolución para cubrir la pantalla principal.

## Calidad y pruebas

Parámetros de URL, junto a `scene=realistic-beach&open-sea-mode=dawn`:

| Parámetro | Marcha principal / luz | Resolución principal |
| --- | --- | --- |
| Sin parámetro adicional | 128 / 6 muestras | 75 % |
| `cloud-quality=low` | 64 / 4 muestras | 40 % |
| `cloud-quality=reference` | 192 / 12 muestras | 100 % |
| `clouds=flat` | Cielo previo con nubes 2D | Sin marcha volumétrica |

El pase principal tiene un límite de 1200 × 800 píxeles. Se actualiza al mover la cámara, cambiar su proyección o redimensionar; con cámara quieta, cada 0,10 segundos. La captura para reflejos se actualiza cada 0,30 segundos o tras un desplazamiento significativo. No hay historial temporal.

Validación realizada el 5 de septiembre de 2026:

- `node --test tests/cloud-noise.test.mjs`: tres pruebas aprobadas (periodicidad, textura y continuidad en los bordes).
- `npm run build`: correcto; permanece el aviso de tamaño del paquete.
- Escena real revisada en Chromium con SwiftShader, sin errores de shader observados.
- Comparación controlada de calidad normal frente a referencia a 480 × 300: error absoluto medio de 2,05/255 por canal; percentil 95 de 10/255. Mide convergencia entre nuestros niveles, no realismo frente a una fotografía.
- El cambio de tiempo modifica la imagen. Redimensionado y cambio de orientación comprobados en una escena aislada.
- Ciclo aislado de creación y destrucción: tres texturas y una geometría asignadas, cero tras `dispose()`; llamada doble a `dispose()` tolerada. Destino de render restaurado tras la actualización.

## Límites pendientes

El aspecto sigue siendo algo suave y necesita dirección artística adicional. No equivale todavía a un renderizador atmosférico de producción: no proyecta sombras de nubes sobre los objetos ni aplica niebla volumétrica según la profundidad de cada objeto. La iluminación múltiple es aproximada y las reflexiones usan una captura centrada en la cámara.

No se han medido FPS en la GPU real del usuario. El movimiento de cámara puede requerir una marcha por fotograma; usar el nivel bajo si el coste resulta excesivo. El búfer CPU de ruido se conserva intencionadamente durante la vida de la página; los recursos GPU sí se liberan por instancia.
