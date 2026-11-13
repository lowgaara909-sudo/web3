const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const codigo = fs.readFileSync(path.join(__dirname, '../assets/explorador.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const nombres = ['cita', 'perro', 'gato', 'dato'];
const turno = () => new Promise(resolve => setImmediate(resolve));
const respuesta = data => ({ ok: true, json: async () => data });

function preparar() {
  const pendientes = [];
  const relojes = new Map();
  let secuencia = 0;
  function nodo() {
    return {
      hidden: true, disabled: true, textContent: '', atributos: {}, eventos: {},
      setAttribute(nombre, valor) { this.atributos[nombre] = valor; },
      removeAttribute(nombre) { delete this[nombre]; },
      addEventListener(nombre, funcion) { this.eventos[nombre] = funcion; }
    };
  }
  const paneles = Object.fromEntries(nombres.map(nombre => {
    assert.ok(html.includes(`data-panel="${nombre}"`));
    const elementos = Object.fromEntries(['button', '.espera', '.resultado', '.aviso', '.registro', 'blockquote', 'figcaption', '.dato', 'img'].map(selector => [selector, nodo()]));
    return [nombre, { ...nodo(), elementos, querySelector: selector => elementos[selector] }];
  }));
  const contexto = vm.createContext({
    Error, TypeError, SyntaxError, URL, AbortController,
    document: { querySelector: selector => paneles[selector.match(/"(.+)"/)[1]] },
    setTimeout(funcion, ms) { const id = ++secuencia; relojes.set(id, { funcion, ms }); return id; },
    clearTimeout(id) { relojes.delete(id); },
    fetch(url, opciones) {
      return new Promise((resolve, reject) => {
        pendientes.push({ url, opciones, resolve, reject });
        opciones.signal.addEventListener('abort', () => reject(new Error('abort')));
      });
    }
  });
  vm.runInContext(codigo, contexto);
  return { pendientes, relojes, paneles, elemento: (nombre, selector) => paneles[nombre].elementos[selector] };
}

test('inicia cuatro GET y representa datos reales del contrato de cada API', async () => {
  const app = preparar();
  assert.equal(app.pendientes.length, 4);
  app.pendientes.forEach(peticion => {
    assert.equal(peticion.opciones.method, 'GET');
    assert.equal(peticion.opciones.cache, 'no-store');
  });
  app.pendientes[0].resolve(respuesta({ quote: 'Cita de prueba', author: 'Autor de prueba' }));
  app.pendientes[1].resolve(respuesta({ status: 'success', message: 'https://example.test/perro.jpg' }));
  app.pendientes[2].resolve(respuesta({ id: 'gato prueba' }));
  app.pendientes[3].resolve(respuesta({ text: 'Dato de prueba' }));
  await turno();
  assert.equal(app.elemento('cita', 'blockquote').textContent, 'Cita de prueba');
  assert.equal(app.elemento('cita', 'figcaption').textContent, '— Autor de prueba');
  assert.equal(app.elemento('dato', '.dato').textContent, 'Dato de prueba');
  assert.equal(app.elemento('gato', 'img').src, 'https://cataas.com/cat/gato%20prueba');
  for (const tipo of ['perro', 'gato']) {
    assert.equal(app.elemento(tipo, 'button').disabled, true);
    app.elemento(tipo, 'img').onload();
  }
  await turno();
  for (const tipo of nombres) {
    assert.equal(app.elemento(tipo, 'button').disabled, false);
    assert.equal(app.elemento(tipo, '.resultado').hidden, false);
    assert.equal(app.elemento(tipo, '.espera').hidden, true);
    assert.equal(app.elemento(tipo, '.registro').textContent, '1 descubrimiento en esta visita');
  }
  assert.equal(app.relojes.size, 0);
});

test('una tarjeta en carga no impide resolver otra y rechaza clics duplicados', async () => {
  const app = preparar();
  app.elemento('cita', 'button').eventos.click();
  assert.equal(app.pendientes.length, 4);
  app.pendientes[3].resolve(respuesta({ text: 'Dato independiente' }));
  await turno();
  assert.equal(app.elemento('dato', 'button').disabled, false);
  assert.equal(app.elemento('cita', 'button').disabled, true);
  app.elemento('dato', 'button').eventos.click();
  assert.equal(app.pendientes.length, 5);
  assert.equal(app.pendientes[4].url, app.pendientes[3].url);
  app.pendientes[4].resolve(respuesta({ text: 'Otro dato' }));
  await turno();
  assert.match(app.elemento('dato', '.registro').textContent, /^2 descubrimientos/);
  assert.equal(app.elemento('cita', '.resultado').hidden, true);
});

for (const [nombre, valor, error, mensaje] of [
  ['HTTP 503', { ok: false, status: 503 }, null, /HTTP 503/],
  ['sin conexión', null, new TypeError('offline'), /conexión a Internet/],
  ['JSON ilegible', { ok: true, json: async () => { throw new SyntaxError(); } }, null, /JSON/],
  ['JSON null', respuesta(null), null, /formato/],
  ['JSON lista', respuesta([]), null, /formato/],
  ['sin campos', respuesta({}), null, /texto de la cita/]
]) {
  test(`${nombre}: error comprensible y recuperación sin recargar`, async () => {
    const app = preparar();
    if (error) app.pendientes[0].reject(error); else app.pendientes[0].resolve(valor);
    await turno();
    assert.equal(app.elemento('cita', '.aviso').hidden, false);
    assert.match(app.elemento('cita', '.aviso').textContent, mensaje);
    assert.equal(app.elemento('cita', 'button').disabled, false);
    assert.equal(app.paneles.cita.atributos['aria-busy'], 'false');
    app.elemento('cita', 'button').eventos.click();
    assert.equal(app.elemento('cita', '.aviso').hidden, true);
    app.pendientes[4].resolve(respuesta({ quote: 'Recuperada', author: 'Prueba' }));
    await turno();
    assert.equal(app.elemento('cita', '.resultado').hidden, false);
    assert.equal(app.elemento('cita', 'button').disabled, false);
    assert.equal(app.elemento('perro', 'button').disabled, true);
  });
}

test('el tiempo límite cancela una solicitud y libera el botón', async () => {
  const app = preparar();
  const timer = [...app.relojes.values()][0];
  assert.equal(timer.ms, 15000);
  timer.funcion();
  await turno();
  assert.equal(app.pendientes[0].opciones.signal.aborted, true);
  assert.match(app.elemento('cita', '.aviso').textContent, /tardó demasiado/);
  assert.equal(app.elemento('cita', 'button').disabled, false);
  assert.equal(app.relojes.size, 3);
});

test('el límite también cubre la lectura del cuerpo de la respuesta', async () => {
  const app = preparar();
  app.pendientes[0].resolve({ ok: true, json: () => new Promise((resolve, reject) => {
    app.pendientes[0].opciones.signal.addEventListener('abort', () => reject(new Error('abort')));
  }) });
  await turno();
  [...app.relojes.values()][0].funcion();
  await turno();
  assert.match(app.elemento('cita', '.aviso').textContent, /tardó demasiado/);
  assert.equal(app.elemento('cita', 'button').disabled, false);
});

for (const evento of ['error', 'timeout']) {
  test(`fallo de imagen (${evento}) sin bloqueo de tarjeta`, async () => {
    const app = preparar();
    app.pendientes[2].resolve(respuesta({ url: '/cat/ejemplo' }));
    await turno();
    const imagen = app.elemento('gato', 'img');
    assert.equal(imagen.src, 'https://cataas.com/cat/ejemplo');
    if (evento === 'error') imagen.onerror(); else [...app.relojes.values()].at(-1).funcion();
    await turno();
    assert.equal(app.elemento('gato', '.aviso').hidden, false);
    assert.equal(app.elemento('gato', 'button').disabled, false);
    assert.equal(imagen.src, undefined);
    assert.equal(imagen.onload, null);
    assert.equal(imagen.onerror, null);
  });
}

test('rechaza URLs inseguras y respuestas fallidas de Dog CEO', async () => {
  const app = preparar();
  app.pendientes[1].resolve(respuesta({ status: 'success', message: 'http://example.test/perro.jpg' }));
  await turno();
  assert.match(app.elemento('perro', '.aviso').textContent, /HTTPS/);
  app.elemento('perro', 'button').eventos.click();
  app.pendientes[4].resolve(respuesta({ status: 'error' }));
  await turno();
  assert.match(app.elemento('perro', '.aviso').textContent, /Dog CEO/);
});
