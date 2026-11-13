"use strict";

// Cada función pública conoce únicamente el contrato de su API.
// El controlador de tarjetas administra los estados comunes de la interfaz.
const SERVICIOS = Object.freeze({
  cita: "https://dummyjson.com/quotes/random",
  perro: "https://dog.ceo/api/breeds/image/random",
  gato: "https://cataas.com/cat?json=true",
  dato: "https://uselessfacts.jsph.pl/api/v2/facts/random?language=en"
});
const ESPERA_MAXIMA = 15000;

function exigirTexto(valor, campo) {
  if (typeof valor !== "string" || valor.trim() === "") {
    throw new Error(`La respuesta no incluye ${campo}.`);
  }
  return valor.trim();
}

async function leerServicio(direccion) {
  const cancelacion = new AbortController();
  const reloj = setTimeout(() => cancelacion.abort(), ESPERA_MAXIMA);
  try {
    const respuesta = await fetch(direccion, {
      method: "GET",
      cache: "no-store",
      signal: cancelacion.signal
    });
    if (!respuesta.ok) {
      throw new Error(`El servicio respondió con un error HTTP ${respuesta.status}.`);
    }
    const contenido = await respuesta.json();
    if (contenido === null || typeof contenido !== "object" || Array.isArray(contenido)) {
      throw new Error("El servicio envió un formato de datos inesperado.");
    }
    return contenido;
  } catch (fallo) {
    if (cancelacion.signal.aborted) throw new Error("La consulta tardó demasiado. Inténtalo de nuevo.");
    if (fallo instanceof SyntaxError) throw new Error("No se pudo interpretar la respuesta JSON.");
    if (fallo instanceof TypeError) throw new Error("No se pudo conectar. Comprueba tu conexión a Internet.");
    throw fallo;
  } finally {
    clearTimeout(reloj);
  }
}

function direccionFoto(valor, base) {
  exigirTexto(valor, "una dirección de imagen válida");
  let direccion;
  try {
    direccion = new URL(valor, base);
  } catch {
    throw new Error("La dirección de la fotografía no es válida.");
  }
  if (direccion.protocol !== "https:") {
    throw new Error("La fotografía no tiene una dirección HTTPS válida.");
  }
  return direccion.href;
}

async function consultarCita() {
  const respuesta = await leerServicio(SERVICIOS.cita);
  return {
    texto: exigirTexto(respuesta.quote, "el texto de la cita"),
    autor: exigirTexto(respuesta.author, "el nombre del autor")
  };
}

async function consultarPerro() {
  const respuesta = await leerServicio(SERVICIOS.perro);
  if (respuesta.status !== "success") throw new Error("Dog CEO no pudo encontrar una fotografía.");
  return { foto: direccionFoto(respuesta.message) };
}

async function consultarGato() {
  const respuesta = await leerServicio(SERVICIOS.gato);
  // La respuesta JSON inspeccionada contiene id y url. Se admite también _id.
  const id = respuesta.id ?? respuesta._id;
  const ruta = respuesta.url || (typeof id === "string" && id.trim()
    ? `/cat/${encodeURIComponent(id)}` : "");
  return { foto: direccionFoto(ruta, "https://cataas.com") };
}

async function consultarDato() {
  const respuesta = await leerServicio(SERVICIOS.dato);
  return { texto: exigirTexto(respuesta.text, "el texto del dato curioso") };
}

function colocarFoto(elemento, direccion) {
  return new Promise((resolve, reject) => {
    function terminar(error) {
      clearTimeout(reloj);
      elemento.onload = null;
      elemento.onerror = null;
      if (error) {
        elemento.removeAttribute("src");
        reject(error);
      } else {
        resolve();
      }
    }
    const reloj = setTimeout(() => terminar(new Error("La fotografía tardó demasiado en cargar.")), ESPERA_MAXIMA);
    elemento.onload = () => terminar();
    elemento.onerror = () => terminar(new Error("La fotografía no está disponible. Prueba con otra."));
    elemento.src = direccion;
  });
}

async function representar(panel, contenido) {
  if (contenido.foto) {
    // Se espera la imagen que realmente aparecerá en la tarjeta.
    await colocarFoto(panel.querySelector("img"), contenido.foto);
  } else if (contenido.autor) {
    panel.querySelector("blockquote").textContent = contenido.texto;
    panel.querySelector("figcaption").textContent = `— ${contenido.autor}`;
  } else {
    panel.querySelector(".dato").textContent = contenido.texto;
  }
}

function conectarTarjeta(nombre, consulta) {
  const panel = document.querySelector(`[data-panel="${nombre}"]`);
  const boton = panel.querySelector("button");
  const espera = panel.querySelector(".espera");
  const resultado = panel.querySelector(".resultado");
  const aviso = panel.querySelector(".aviso");
  const registro = panel.querySelector(".registro");
  let ocupada = false;
  let descubrimientos = 0;

  async function actualizar() {
    if (ocupada) return;
    ocupada = true;
    boton.disabled = true;
    panel.setAttribute("aria-busy", "true");
    espera.hidden = false;
    resultado.hidden = true;
    aviso.hidden = true;
    registro.textContent = "Buscando tu próxima sorpresa…";

    try {
      const contenido = await consulta();
      await representar(panel, contenido);
      descubrimientos += 1;
      resultado.hidden = false;
      registro.textContent = `${descubrimientos} ${descubrimientos === 1 ? "descubrimiento" : "descubrimientos"} en esta visita`;
    } catch (fallo) {
      aviso.textContent = `${fallo.message} Usa el botón para reintentar.`;
      aviso.hidden = false;
      registro.textContent = "Esta ventana puede volver a intentarlo";
    } finally {
      espera.hidden = true;
      boton.disabled = false;
      panel.setAttribute("aria-busy", "false");
      ocupada = false;
    }
  }

  boton.addEventListener("click", actualizar);
  // No se espera a otra tarjeta: los cuatro servicios avanzan por separado.
  actualizar();
}

conectarTarjeta("cita", consultarCita);
conectarTarjeta("perro", consultarPerro);
conectarTarjeta("gato", consultarGato);
conectarTarjeta("dato", consultarDato);
