# Explorador de contenido aleatorio

**Estudiante:** Mathias

**Materia:** Programación Web III

Página hecha con HTML, CSS y JavaScript para practicar consultas a APIs. Se utilizó Codex como apoyo durante el desarrollo. No necesita base de datos ni inicio de sesión.

## Qué hace

Al entrar aparecen cuatro tarjetas con una cita, un perro, un gato y un dato curioso. Cada botón consulta exclusivamente su API. Mientras espera, la tarjeta muestra «Cargando…» y deshabilita su botón. Los errores se muestran dentro de la tarjeta y permiten reintentar sin recargar la página.

Las tarjetas se organizan en dos columnas en computadora y en una columna en teléfonos. Las fotografías ocupan espacios uniformes y usan `object-fit: contain` para mostrarse completas. Cada tarjeta cuenta las consultas exitosas de la visita; los resultados aleatorios pueden repetirse.

## Archivos

```text
ExploradorAzar_Mathias/
├── index.html
├── assets/
│   ├── explorador.css
│   └── explorador.js
├── tests/
│   └── explorador.test.cjs
├── capturas/
│   ├── funcionamiento.jpg
│   └── error-controlado.jpg
├── .gitignore
└── README.md
```

## Ejecución

1. Extrae el ZIP y abre la carpeta que contiene `index.html`.
2. Si usas VS Code y tienes Live Server, abre `index.html` con esa extensión.
3. Alternativamente, con Python instalado, abre CMD en esa carpeta y ejecuta:

   ```cmd
   python -m http.server 5500
   ```

4. Abre `http://localhost:5500` en el navegador. Mantén conexión a Internet para consultar las APIs.
5. Para cerrar el servidor, presiona `Ctrl+C` en CMD.

No necesitas instalar dependencias del proyecto. El comando de Python sirve archivos estáticos; no implementa un backend de la aplicación.

## Cómo está organizado el JavaScript

- `consultarCita`, `consultarPerro`, `consultarGato` y `consultarDato` interpretan las respuestas de cada proveedor.
- `leerServicio` hace el `fetch`, verifica el estado HTTP, lee el JSON y cancela esperas mayores a 15 segundos con `AbortController`.
- `colocarFoto` escucha `load` y `error` en el propio elemento `<img>`. También tiene un límite de 15 segundos.
- `conectarTarjeta` mantiene los estados y el contador de una tarjeta. Su bloque `finally` libera el botón tanto ante éxito como ante error.
- `representar` actualiza texto con `textContent` o espera la fotografía. Las respuestas externas no se insertan como HTML.

## Preguntas de reflexión

### 1. ¿Qué es un endpoint y cuál utilizaste para cada API?

Un endpoint es la dirección concreta de un servicio a la que se envía una solicitud. En este proyecto las cuatro solicitudes son HTTP GET:

| Contenido | Endpoint | Campos que se leen |
| --- | --- | --- |
| Cita | `https://dummyjson.com/quotes/random` | `quote`, `author` |
| Perro | `https://dog.ceo/api/breeds/image/random` | `status`, `message` |
| Gato | `https://cataas.com/cat?json=true` | `url`, o `id` / `_id` |
| Dato curioso | `https://uselessfacts.jsph.pl/api/v2/facts/random?language=en` | `text` |

### 2. ¿Qué diferencia existe entre recibir JSON y recibir directamente una imagen?

JSON contiene datos estructurados que JavaScript puede interpretar: por ejemplo, el autor de una cita o la dirección de una foto. Una respuesta de imagen contiene los bytes del archivo visual. No se puede leer esa imagen con `response.json()`.

Antes de programar se inspeccionó [el JSON de CATAAS](https://cataas.com/cat?json=true), que presentaba `id`, `tags`, `created_at`, `url` y `mimetype`. La aplicación obtiene `url` o construye `/cat/{id}` y asigna esa dirección al `<img>`. El endpoint `/cat` sin `json=true` se destina a recibir la imagen directamente.

### 3. ¿Qué función cumplen `await` y `response.json()`?

`await` espera a que termine una promesa dentro de una función `async` y permite usar su resultado en la siguiente instrucción. La espera de esa función no impide que las demás tarjetas trabajen. `response.json()` lee el cuerpo de la respuesta y lo interpreta como JSON; también devuelve una promesa, por lo que se espera con `await`.

### 4. ¿Por qué se debe verificar `response.ok` además de utilizar `try/catch`?

Una respuesta HTTP 404 o 500 puede resolver normalmente la promesa de `fetch`. Eso no significa que la consulta haya sido exitosa. `response.ok` indica si el estado pertenece al rango 200–299. Si es falso, el código lanza un error que luego captura `catch`. Ese bloque también maneja problemas de red, de lectura del JSON o de validación de los campos.

### 5. ¿Cómo lograste actualizar una sección sin recargar toda la página?

Cada botón ejecuta el controlador de su tarjeta. Este obtiene nuevos datos y actualiza únicamente los elementos que están dentro de ese panel, mediante `textContent` o `src`. No se envía un formulario ni se llama a `location.reload()`. Cada controlador conserva su propia variable de carga y su contador, así que no bloquea las otras tres secciones.

## Comprobación y capturas

1. Abre la página con conexión y espera a ver contenido en las cuatro tarjetas.
2. Haz una captura de funcionamiento. Pulsa distintos botones y verifica que cada uno actualiza solo su tarjeta.
3. Para comprobar un fallo, mantén la página abierta, selecciona **Offline** en la pestaña **Network** de las herramientas del navegador y pulsa un botón. También puedes desconectar temporalmente Internet.
4. Captura el error dentro de esa tarjeta y verifica que su botón vuelve a habilitarse. Las otras tarjetas deben conservar su contenido.
5. Restablece la conexión y pulsa el mismo botón para comprobar la recuperación.
6. Prueba además la vista estrecha de un teléfono y la navegación con la tecla Tab.

Las pruebas automáticas no requieren Internet ni paquetes adicionales. Con Node.js instalado:

```cmd
node --test tests/explorador.test.cjs
```

Los datos simulados pertenecen exclusivamente a las pruebas; el sitio no utiliza citas, datos ni imágenes de muestra.

### Resultado de la revisión

- 13 pruebas automáticas aprobadas y sintaxis JavaScript verificada.
- Las cuatro APIs cargaron contenido real en el navegador.
- Al solicitar otra cita solo cambió esa tarjeta y su contador.
- En la vista de celular las tarjetas se apilaron y no hubo desbordamiento horizontal.
- Se incluyen las capturas de funcionamiento y de error controlado en `capturas/`.

Para obtener la captura de error se cambió temporalmente el endpoint de citas por una ruta inexistente del servidor local, que respondió HTTP 404. Las otras tres APIs continuaron funcionando y el botón de citas se habilitó para reintentar. Después se restauró el endpoint de DummyJSON: el código entregado no contiene esa configuración de prueba. La captura documenta una simulación controlada, no una caída de DummyJSON.

## Entrega

Completa tu nombre académico, revisa las respuestas y adjunta el ZIP, el enlace a tu repositorio y las dos capturas. El historial Git incluido en el paquete pertenece únicamente a esta implementación nueva. Para subirlo conservando el commit, extrae el ZIP y ejecuta `git remote add origin URL_DEL_REPOSITORIO` y `git push -u origin main` dentro de la carpeta del proyecto, apuntando a un repositorio vacío.

## Documentación consultada

- [DummyJSON: citas](https://dummyjson.com/docs/quotes)
- [Dog CEO: imagen aleatoria](https://dog.ceo/dog-api/documentation/random)
- [CATAAS](https://cataas.com/)
- [Useless Facts](https://uselessfacts.jsph.pl/)
