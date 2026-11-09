# NEON//DAY 3.0 · Vercel + Supabase

Versión V3 preparada para desplegarse directamente en Vercel.

## Arquitectura

```text
Navegador
   │
   ├── Vercel CDN
   │      ├── index.html
   │      ├── styles.css
   │      └── app.js
   │
   └────────────── HTTPS ──────────────► Supabase
                                      ├── Auth
                                      └── Postgres + RLS
```

La aplicación es estática y usa `@supabase/supabase-js` desde CDN. Durante el build de Vercel, `scripts/generate-config.js` genera `config.js` usando las variables de entorno del proyecto.

## 1. Supabase

En Supabase:

1. Crea el proyecto.
2. Ejecuta `supabase/schema.sql` en **SQL Editor**.
3. Activa **Anonymous Sign-Ins** en Authentication > Providers.
4. En Settings > API copia:
   - Project URL
   - Publishable key (o anon key si tu proyecto todavía usa las claves legacy).

El cliente usa la clave pública. **No uses una `service_role`/secret key en el frontend.**

## 2. Vercel

### Opción A: GitHub + Vercel

1. Sube esta carpeta a un repositorio de GitHub.
2. En Vercel selecciona **Add New > Project** e importa el repositorio.
3. Vercel detectará `package.json`.
4. En **Settings > Environment Variables** añade:

```text
SUPABASE_URL=https://TU-PROYECTO.supabase.co
SUPABASE_PUBLISHABLE_KEY=TU_SUPABASE_PUBLISHABLE_KEY
```

Selecciona al menos **Production**. Para trabajar con ramas, puedes añadirlas también a **Preview**.

5. Despliega.

Vercel ejecutará:

```text
npm run build
```

y generará automáticamente `config.js`.

### Opción B: Vercel CLI

Desde la carpeta:

```bash
npm install
npx vercel login
npx vercel link
npx vercel env add SUPABASE_URL production
npx vercel env add SUPABASE_PUBLISHABLE_KEY production
npx vercel --prod
```

## 3. Comprobar el despliegue

Abre la URL de Vercel y comprueba la cabecera:

```text
● SUPABASE
```

Después crea una actividad. Debe aparecer en Supabase > Table Editor > `activities`.

Si aparece:

```text
● LOCAL · SIN CONEXIÓN
```

revisa las variables de entorno y vuelve a desplegar.

## 4. Seguridad

La clave pública/publishable está destinada a aplicaciones cliente. La seguridad real de los datos la proporciona RLS.

La tabla `activities` tiene políticas para que el usuario autenticado solo pueda leer, insertar, modificar y borrar sus propias filas.

**Nunca subas a GitHub ni introduzcas en `config.js` una `service_role` key o secret key.**

## 5. Preview deployments

Vercel crea despliegues Preview para ramas distintas de producción. Puedes asignar variables de entorno específicas para Preview si quieres separar una base de pruebas de la base de producción.

## 6. Dominio propio

Cuando el proyecto esté funcionando, puedes añadir tu dominio desde:

Vercel → Project → Settings → Domains

Para la autenticación por email/OAuth futura, recuerda añadir el dominio de producción y las URLs de Preview permitidas en Supabase Auth → URL Configuration.

## Archivos relevantes

- `index.html` → interfaz.
- `app.js` → lógica y Supabase.
- `styles.css` → diseño.
- `config.js` → generado durante el build de Vercel, no contiene secretos.
- `scripts/generate-config.js` → convierte variables de entorno en configuración frontend.
- `vercel.json` → configuración de despliegue.
- `supabase/schema.sql` → tabla y RLS.
- `.env.example` → plantilla local.
