# Keweke · Presupuestos

Aplicación web para la gestión de presupuestos de producción audiovisual, diseñada a medida para [Keweke](https://www.keweke.com), productora audiovisual de Barcelona.

Permite crear, editar y archivar presupuestos con plantillas adaptadas a diferentes tipos de proyecto (generales, de postproducción, simplificados), generar PDFs profesionales con la marca corporativa, y rellenar presupuestos automáticamente dictando la descripción del proyecto gracias a IA (Google Gemini).

![Keweke](https://img.shields.io/badge/Keweke-FF4A31?style=for-the-badge)
![Firebase](https://img.shields.io/badge/Firebase-F9A825?style=for-the-badge&logo=firebase&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Gemini](https://img.shields.io/badge/Gemini_2.5-4285F4?style=for-the-badge&logo=google&logoColor=white)

---

## ✨ Características principales

- **Tres plantillas de presupuesto**: General (proyecto completo), Postproducción (solo post), y Corta (versión simplificada).
- **Dictado con IA**: describes el proyecto con voz o texto, y Gemini rellena automáticamente las partidas con unidades y jornadas.
- **Editor en tiempo real**: ajusta cualquier partida, añade o elimina conceptos, modifica precios y descuentos.
- **Generación de PDF**: exporta presupuestos profesionales con la identidad de marca de Keweke.
- **Gestión de clientes**: autocompletado de clientes existentes al crear nuevos presupuestos.
- **Estados de flujo**: Borrador → Enviado → Aprobado / Rechazado.
- **Backup automático**: cada PDF generado se guarda en Google Drive para consulta posterior.
- **Autenticación con Google**: acceso restringido al equipo Keweke.
- **Modo claro/oscuro**: interfaz adaptable.

---

## 🏗 Arquitectura

La aplicación se compone de tres piezas principales:

```
┌──────────────────────┐      ┌─────────────────────────┐      ┌─────────────────┐
│   Frontend (React)   │      │  Cloud Functions        │      │   Gemini API    │
│   index.html         │─────►│  (Firebase / Node.js)   │─────►│   (Google AI)   │
│   GitHub Pages       │      │  europe-west1           │      │                 │
└──────────┬───────────┘      └─────────┬───────────────┘      └─────────────────┘
           │                            │
           │                            ├─────────►  Google Drive (backup PDFs)
           │                            │
           ▼                            ▼
┌──────────────────────────────────────────────┐
│  Firebase                                    │
│  · Firestore (datos de presupuestos)         │
│  · Storage (archivos HTML/PDF)               │
│  · Auth (Google Sign-In)                     │
│  · Secret Manager (API Keys)                 │
└──────────────────────────────────────────────┘
```

- **Frontend**: aplicación single-page en React, empaquetada en un único `index.html` y servida desde GitHub Pages.
- **Backend**: Cloud Functions de Firebase que hacen de proxy seguro entre el frontend y Gemini (la API Key nunca llega al navegador), y que gestionan el backup de PDFs en Google Drive.
- **Base de datos**: Firestore almacena los presupuestos; Storage guarda los PDFs; Auth controla quién puede acceder.

---

## 🚀 Puesta en marcha

### Requisitos previos

- Cuenta de Google con acceso al proyecto Firebase `keweke-presupuestos-583aa`
- [Node.js 20 o 22](https://nodejs.org/)
- [Firebase CLI](https://firebase.google.com/docs/cli): `npm install -g firebase-tools`
- Git

### 1. Clonar el repositorio

```bash
git clone https://github.com/unairosende/keweke-presupuestos.git
cd keweke-presupuestos
```

### 2. Autenticarse en Firebase

```bash
firebase login
```

Usa la cuenta de Google autorizada en el proyecto.

### 3. Desplegar el frontend

El `index.html` se publica vía GitHub Pages. Para que los cambios sean visibles:

```bash
git add index.html
git commit -m "Actualización del frontend"
git push
```

GitHub Pages lo desplegará automáticamente en `https://unairosende.github.io/keweke-presupuestos/` en pocos segundos.

### 4. Desplegar las Cloud Functions (solo si se modifican)

```bash
cd functions
npm install
firebase deploy --only functions
```

Para desplegar solo una función concreta:

```bash
firebase deploy --only functions:geminiGenerate
```

---

## 🔐 Gestión de la API Key de Gemini

> ⚠️ **IMPORTANTE**: la API Key de Gemini **NUNCA** debe aparecer en el código del frontend ni en el repositorio. Google escanea GitHub y revoca automáticamente cualquier key que encuentre expuesta.

La key se almacena cifrada en **Google Secret Manager** y solo la Cloud Function tiene acceso a ella.

### Rotar la API Key

Si hay que actualizar la key (por rotación de seguridad, porque caduca, o porque se ha filtrado):

1. Obtén una nueva key en [Google AI Studio](https://aistudio.google.com/apikey) → "Create API key" → selecciona el proyecto `keweke-presupuestos-583aa`.

2. Guárdala como secreto en Firebase:

   ```bash
   cd functions
   firebase functions:secrets:set GEMINI_KEY
   ```

   Cuando lo pida, pega la nueva key completa y pulsa Enter.

3. Redespliega la función para que recoja el nuevo valor:

   ```bash
   firebase deploy --only functions:geminiGenerate
   ```

4. Verifica que funciona:

   ```bash
   curl -X POST https://europe-west1-keweke-presupuestos-583aa.cloudfunctions.net/geminiGenerate \
     -H "Content-Type: application/json" \
     -H "Origin: https://unairosende.github.io" \
     -d '{"prompt":"Responde solo con la palabra: ok"}'
   ```

   Debe devolver `{"result":"ok"}` o similar.

---

## 📋 Estructura del proyecto

```
keweke-presupuestos/
├── index.html              # Frontend completo (React + CSS + lógica)
├── functions/              # Cloud Functions de Firebase
│   ├── index.js            # geminiGenerate, backupPDFtoDrive, etc.
│   ├── package.json        # Dependencias de Node
│   └── .gitignore
├── firebase.json           # Configuración de hosting, functions, firestore
├── firestore.rules         # Reglas de seguridad de la base de datos
└── README.md               # Este archivo
```

### Cloud Functions incluidas

| Función | Descripción | Trigger |
|---|---|---|
| `geminiGenerate` | Proxy seguro entre frontend y Gemini | HTTP POST |
| `backupPDFtoDrive` | Guarda copia de cada PDF en Google Drive | Storage: nuevo archivo en `pdfs/` |
| `deletePDFfromDrive` | Elimina del Drive al borrar presupuesto | Firestore: documento eliminado |
| `deleteDriveFile` | Borra un archivo concreto de Drive | HTTP POST |

---

## 🎯 Uso diario de la aplicación

### Crear un presupuesto manualmente

1. Pulsa **+ Nuevo** en la esquina superior derecha.
2. Elige el tipo de plantilla (General, Postproducción, Corta).
3. Selecciona la pestaña **✍ Manual**.
4. Introduce cliente y nombre del proyecto.
5. Pulsa **Crear**. Se abrirá el editor con la plantilla vacía.
6. Rellena las partidas con unidades, jornadas, precios y descuentos.
7. Cuando esté listo, pulsa **Guardar** y luego **Descargar PDF**.

### Crear un presupuesto con IA

1. Pulsa **+ Nuevo**.
2. Elige la plantilla.
3. Selecciona la pestaña **🎙 Dictar con IA**.
4. Describe el proyecto con el micrófono o escribiendo en el cuadro de texto.
   - **Ejemplo**: *"Spot para Freshly Cosmetics. Un día de rodaje en Barcelona interior. Realizador, DoP, sonidista y maquilladora. Dos protagonistas. Post con edición, música de archivo y un máster."*
5. Pulsa **Generar con IA**. En 5-10 segundos tendrás el presupuesto rellenado.
6. Revisa y ajusta cualquier partida que necesites.

### Estados del presupuesto

- 🟠 **Borrador** — en edición, todavía no enviado al cliente.
- 🔵 **Enviado** — presupuesto entregado al cliente, pendiente de respuesta.
- 🟢 **Aprobado** — cliente ha dado OK, proyecto en marcha.
- 🔴 **Rechazado** — cliente no lo ha aceptado.

---

## 💰 Costes estimados

La aplicación utiliza servicios de Google con cuota gratuita muy generosa. Para un uso típico:

| Uso | Coste estimado/mes |
|---|---|
| 100 presupuestos con IA | ~0,25 $ |
| 1.000 presupuestos con IA | ~2,50 $ |
| Firebase (Firestore + Storage + Functions) | 0 $ (dentro del plan Blaze gratuito) |

Se recomienda configurar una **alerta de presupuesto** en Google Cloud Console (Billing → Budgets & alerts) con un límite de 5 $/mes para detectar cualquier anomalía.

---

## 🛠 Solución de problemas comunes

### El dictado con IA devuelve "Error 500" o no responde

1. Comprueba que la Cloud Function está desplegada: `firebase functions:list`
2. Verifica que el secreto `GEMINI_KEY` existe: `firebase functions:secrets:access GEMINI_KEY`
3. Revisa los logs: `firebase functions:log --only geminiGenerate`

### Error "This model is no longer available"

Google descataloga modelos periódicamente. Edita `functions/index.js` y actualiza la referencia al modelo a la última versión estable (por ejemplo, de `gemini-2.5-flash` a `gemini-3-flash` cuando esté disponible). Consulta [la lista de modelos](https://ai.google.dev/gemini-api/docs/models).

### Los PDFs no aparecen en Drive

La función `backupPDFtoDrive` necesita que la carpeta de destino (`DRIVE_FOLDER_ID` en `index.js`) esté compartida con la **cuenta de servicio** del proyecto Firebase. Esa cuenta tiene formato `keweke-presupuestos-583aa@appspot.gserviceaccount.com`.

### Error CORS en el navegador

La Cloud Function solo acepta peticiones desde `https://unairosende.github.io`. Si despliegas el frontend en otro dominio, añade el nuevo origen en `functions/index.js`:

```javascript
res.set("Access-Control-Allow-Origin", "https://tu-nuevo-dominio.com");
```

Y redespliega la función.

---

## 🔒 Seguridad

- **Nunca** commitees API Keys ni tokens en el repositorio.
- La autenticación de usuarios se gestiona con Firebase Auth (Google Sign-In). Solo las cuentas autorizadas pueden acceder.
- Las reglas de Firestore limitan qué usuarios pueden leer/escribir documentos.
- La API Key de Gemini vive en Google Secret Manager, nunca en el código.
- Si crees que la key ha sido expuesta, rótala inmediatamente siguiendo las instrucciones de más arriba.

---

## 🤝 Contribuir

Este es un proyecto interno de Keweke, pero si detectas algún bug o tienes sugerencias:

1. Abre un issue en GitHub describiendo el problema.
2. Si quieres proponer cambios, crea una rama nueva y abre una pull request.
3. Prueba siempre los cambios localmente antes de hacer push a main.

---

## 📜 Licencia

Proyecto privado de Keweke. Todos los derechos reservados.

---

## 👤 Contacto

- **Keweke** — [www.keweke.com](https://www.keweke.com)
- **C/ Muntaner 479, ático 4º · 08021 Barcelona**
- **CIF B65430381**

---

*Desarrollado con ❤️ para el equipo de Keweke*
