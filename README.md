Este es un proyecto llamado DocsAssist para la gestión de documentos y un asistente IA de búsqueda

Basado en el framework [Next.js](https://nextjs.org) creado con el comando [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Requisitos
En tu equipo de cómputo necesitas tener instalado
```bash
NodeJS (version: 26.13.0 preferentemente)
NPM (version: 11.20.0 preferentemente)
Docker
Ollama
qwen3-embedding:0.6b (como modelo IA)
```

## Si no tienes instalado Ollama
```bash
Realiza la descarga desde https://ollama.com/download e instala la version segun tu sistema operatico (Windows, macOS o Linux)
```

## Validar si tienes instalado el modelo IA: qwen3-embedding:0.6b
```bash
Abre una terminal de comandos (cmd, powershell, etc) segun tu sistema operativo
Ejecuta el siguiente comando: ollama list
Si no te aparece en el listado la opcion: qwen3-embedding:0.6b
Ejecuta el siguiente comando: ollama pull qwen3-embedding:0.6b
Espera a que termine (tarda menos de 10 min aproximadamente dependiendo de la conexion a Internet)
```

## Como iniciar el proyecto

Desde una terminal de comandos, ingresa a la carpeta donde esta el proyecto (la raiz donde se visualicen las carpetas: app, lib, public, etc). Ejecuta los siguientes comandos:

```bash
docker compose up -d
npm install
npm run dev
```

Abre un navegador Web e ingresa a: http://localhost:3000

Realiza el registro con tus datos (pueden ser datos no reales) para ingresar al sistema

Carga tus documentos y haz uso del asistente de busqueda.

Consulta tus respuestas en el historial

## Librerias usadas

| Nombre | Uso |
| --- | --- |
| bcryptjs | Encriptación de contraseñas de los usuarios que se registran y para validar la contraseña de los usuarios durante el login |
| pdf-parse |  Extracción de textos de documentos .PDF |
| react-query |  Actualmente conocida como TanStack Query. Gestionar la actualización de datos provenientes del servidor, maneja el uso de cache y simplifica los procesos en lugar de usar los hooks de useEffect y useState |
| jose |  Para la generación del JWT (JSON Object Signing and Encryption) |
| node:crypto |  Para realizar el hash del contenido de los documentos, evitando la duplicidad del contenido (por usuario) |
| next/server |  Usado para crear un middleware (Route Handlers) |

## Estructura y comportamiento del sistema
```bash
Descripcion
Use pgvector como extension de PostgreSQL para el manejo de vectores el cual permite busquedas semanticas y RAG (maneja muy bien los embeddings)
Use Ollama el cual me permite usar modelos de lenguaje (LLM) en mi equipo local lo que permite conservar la privacidad de mis documentos.
Use NextJS como framework ya que me permite:
  - Integracion con React de manera mas limpia y simple
  - Me permite el renderizado del lado del servidor
  - Las rutas se crear facilmente por medio de los archivos y carpetas sin usar librerias de enrutamiento
  - Me permite desarrollar de manera Full-Stack
  - Soporta TypeScript lo que me permite usar tipado que me ayuda a detectar errores durante la fase de compilacion y desarrollo antes de llegar a produccion
Use qwen3-embedding:0.6b ya que esta diseñada especialmente para:
  - Tareas de embedding (representacion vectorial)
  - Comprension de textos extensos y habilida de razonamiento
  - Buen rendimiento
  - Es ligero y facil de ejecutar de forma local (equipos de computo con capacidades limitadas)
En un principio use ChatClient (del paquete org.springframework.ai.chat.client en un proyecto de SpringBoot).
Sin embargo al procesar los datos para generar la respuesta del asistente, tardaba hasta 45 minutos considerando 4 fragmentos a procesar
Podemos ver el tiempo de respuesta en esta imagen: http://ingeniabi.com/SpringIA.jpeg
Por temas de performance, decidi integrar el SDK de Anthropic que me permite conectar mi aplicacion con los modelos de IA de Claude
Esto me permite ralizar la busqueda semantica (mas adelante se explica el proceso a detalle).

En la base de datos:
Realice la encriptacion de contraseñas de cada usuario para:
  - Evitar el acceso no autorizados
  - Use un campo llamado estatus para habilitar-deshabilitar el acceso a dichos usuarios
  - Agregue el campo fecha de creacion como campo de control
  - La tabla se llama: usuarios_assist
Cree una tabla donde se almacena la informacion de los documentos (documents) como:
  - Sus metadatos
  - El usuario al que pertenece dicho documento.
  - El hash del contenido para validar y evitar duplicidad
Cree una tabla de fragmentos de documentos (chunks) donde se almacena:
  - Las diferentes paginas-contenido 
  - El Id del documento al que pertenece.
  - El vector y el contenido en texto plano
Cree una tabla donde se guardan las preguntas con sus respectivas respuestas (questions) con los siguientes campos:
  - Id del usuario que realizo la pregunta
  - Seccion donde se indican los documentos donde se extrajo dicha respuesta (en formato JSON)

Funciones del sistema
Para la carga de los listados de documentos y preguntas-respuestas:
 - Use TanStack Query para realizar de manera eficiente la carga de informacion desde el servidor y manejo de cache
 - Asi mismo manejar mensajes personalizados en caso de que el sistema este fuera de linea
Para la carga de listados:
  - Use paginacion por cursor a traves de los campos fecha de creacion e id (paginado de 10 en 10).
  - Si se procede a eliminar un registro, el paginado se recalcula posicionando en la pagina segun corresponde
Para la autenticacion de usuarios use:
  - JWT junto con httponly cookie para no guardar el JWT en el localstorage evitando vulnerabilidades de tipo XSS
Los documentos y preguntas son clasificadas por usuario

Funciones del asistente
Use claude-opus-5-5 como modelo ya que:
  - Usa un razonamiento profundo a diferencia de Sonnet y Haiku, los cuales se usan más en entornos de programación, agentes y tareas sencillas de automátización
El proceso es: 
1 - Se toman 5 fragmentos de pgvector basados en el contenido de la pregunta (tomamos los datos de la tabla chunks)
2 - Se valida que exista contenido. Si no hay, se manda un mensaje indicando que no hay documentos y se termina el proceso
3 - Si hay contenido, se genera un documento por fragmento con su titulo original (Ejemplos: Como programar.txt, Linux_Server.pdf)
4 - Se realiza la peticion al servidor de Claude la cual envia los siguientes datos:
  - Uso del modelo: claude-opus-5-5
  - Maximo de tokens de uso
  - El PROMPT
  - La pregunta
  - El rol "user" el cual es usado por el modelo de Claude para representar mensajes, preguntas, etc.
5 - Si la respuesta proviene de los fragmentos, se generan los segmentos para identificar que respuesta pertenece a que documento
6 - Se realiza el registro en la tabla de preguntas-respuestas independientemente si la respuesta esta en los documentos o no a manera de bitacora
7 - Si la aplicacion esta fuera de linea se manda un mensaje al usuario
```