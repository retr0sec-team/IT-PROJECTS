# Retr0sec by NexuzLabs

Landing page estática educativa con estética cyberpunk, HTML, CSS y JavaScript.

## Archivos
- `index.html`: estructura y contenido.
- `styles.css`: diseño responsive y efectos visuales.
- `script.js`: intro de arranque, fondo Matrix, navegación, SOC ficticio y validación del formulario.

## Ejecutar en local
Abre `index.html` en el navegador. Para evitar limitaciones de algunos navegadores, también puedes iniciar un servidor estático en esta carpeta:

```bash
python3 -m http.server 8000
```

Después visita `http://localhost:8000`.

## Importante
- El panel SOC y sus registros son datos simulados, no monitorizan sistemas reales.
- El formulario solo muestra una confirmación local; no transmite ni guarda información.
- Chart.js y las fuentes se cargan desde CDN, por lo que esas partes necesitan conexión a Internet.
- Para recibir solicitudes reales, conecta un backend o proveedor de formularios. No pongas claves privadas de API en `script.js` ni en el HTML público.
- Usa las herramientas de ciberseguridad solo en sistemas propios o con autorización.


## Página de GitHub Pages

https://retr0sec-team.github.io/Learning/
