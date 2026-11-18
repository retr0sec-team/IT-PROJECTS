# STARLIFE 24 — Foundation 1.0

Base visual independiente para el cibercafé STARLIFE 24, cafetería y escape room de misión hacker.

## Incluye
- Portada pública responsive y navegación.
- Secciones Cybercafé, Cafetería, Hacker Mission, Eventos, Reservas y Contacto.
- Panel administrativo conceptual en `admin/index.html`.
- Formulario de interés validado localmente, sin envío ni almacenamiento.
- Identidad visual cyberpunk y logo SVG.

## Ejecutar en local
Desde esta carpeta:
```bash
python3 -m http.server 8080
```
Abre `http://localhost:8080`. También puedes usar Live Server en VS Code.

## Estructura
- `index.html`: web pública.
- `admin/index.html`: maqueta del panel privado.
- `css/`: estilos públicos y administrativos.
- `js/`: interacciones del menú y formulario.
- `assets/logo.svg`: logotipo vectorial.

## Estado y seguridad
La web y el panel son prototipos frontend. **El panel no está protegido todavía**: no introducir ni publicar datos reales. No hay autenticación, roles, base de datos ni reservas reales. El formulario solo valida los campos en el navegador y muestra un aviso de demostración.

No se incluyen claves de Supabase. La integración futura usará únicamente la clave publicable en el frontend, con RLS correctamente configurado; `service_role` quedará reservada para un backend seguro.

## Personalización antes de publicar
Completar dirección, email, teléfono, tarifas, inventario de ordenadores, carta, capacidad y condiciones del escape room, fotografías y redes sociales.

## Siguiente fase
Supabase Auth, perfiles y roles, esquema PostgreSQL y políticas RLS; después se conectarán las reservas y los módulos administrativos.
