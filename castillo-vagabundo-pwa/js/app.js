// ===== Personajes (cambia nombres/frases si quieres) =====
var PERSONAJES = {
    howl:     { nombre: 'Howl',           saludo: '¡Bienvenido! Este castillo siempre encuentra un nuevo lugar para una buena conversación.' },
    sophie:   { nombre: 'Sophie',         saludo: 'Hola. Siéntate un momento; todo se arregla mejor con calma y una taza de té.' },
    calcifer: { nombre: 'Calcifer',       saludo: '¡Por fin alguien con quien hablar! Cuéntame algo antes de que se apaguen los leños.' },
    markl:    { nombre: 'Markl',          saludo: '¡Hola! Estoy practicando mis trucos, pero puedo hacer una pausa para leerte.' },
    nabo:     { nombre: 'Cabeza de Nabo', saludo: 'Cabeza de Nabo te saluda con una inclinación silenciosa.' }
};

// ===== Referencias =====
var titulo = $('#titulo'), nuevoBtn = $('#nuevo-btn'), salirBtn = $('#salir-btn');
var cancelarBtn = $('#cancel-btn'), postBtn = $('#post-btn'), avatarSel = $('#seleccion');
var timeline = $('#timeline'), modal = $('#modal'), modalAvatar = $('#modal-avatar');
var avatarBtns = $('.seleccion-avatar'), txtMensaje = $('#txtMensaje');
var notifBtn = $('#notif-btn'), estado = $('#estado');

var usuario;                 // personaje elegido
var STORAGE_KEY = 'castillo-mensajes';
var PUSH_SERVER = 'http://localhost:3000';
var VAPID_PUBLIC_KEY = 'BKsTf1wxQNiM0tlZUpgzbxoPP-C3phHxs4wEKs7MgK-XJ1vp37vl3YWUNewnNjvTS7I-pHIrGUna2TVpWXmCwpM';

function convertirClaveVapid(clave) {
    var base64 = (clave + '='.repeat((4 - clave.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/');
    var binario = window.atob(base64);
    var bytes = new Uint8Array(binario.length);
    for (var index = 0; index < binario.length; index++) bytes[index] = binario.charCodeAt(index);
    return bytes;
}

async function registrarSuscripcionPush() {
    if (!('PushManager' in window)) throw new Error('Push no está disponible en este navegador');
    var registro = await navigator.serviceWorker.ready;
    var suscripcion = await registro.pushManager.getSubscription();
    if (!suscripcion) {
        suscripcion = await registro.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertirClaveVapid(VAPID_PUBLIC_KEY)
        });
    }
    var respuesta = await fetch(PUSH_SERVER + '/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(suscripcion)
    });
    if (!respuesta.ok) throw new Error('El servidor rechazó la suscripción push');
}

async function enviarPush(titulo, cuerpo) {
    var respuesta = await fetch(PUSH_SERVER + '/api/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: titulo, body: cuerpo })
    });
    if (!respuesta.ok) throw new Error('No se pudo enviar la notificación push');
    return respuesta.json();
}

async function notificarMensajeEnviado(titulo, cuerpo) {
    try {
        var resultado = await enviarPush(titulo, cuerpo);
        if (!resultado.enviadas) mostrarNotificacion(titulo, cuerpo, usuario);
    } catch (error) {
        console.error('No se pudo contactar el servidor push:', error);
        mostrarNotificacion(titulo, cuerpo, usuario);
    }
}

// ===== Mensajes =====
function escapar(t) { return $('<div>').text(t).html(); }

function mensajeHTML(m) {
    return '<li class="animated fadeIn fast">' +
        '<div class="avatar"><img src="img/avatars/' + m.personaje + '.jpg" alt=""></div>' +
        '<div class="bubble-container"><div class="bubble">' +
        '<h3>@' + m.personaje + '</h3>' + escapar(m.texto) +
        '<span class="hora">' + m.hora + '</span></div><div class="arrow"></div></div></li>';
}

function guardar(lista) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(lista)); } catch (e) {} }
function cargar() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch (e) { return []; } }

function agregarMensaje(personaje, texto) {
    var m = { personaje: personaje, texto: texto, hora: new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) };
    timeline.prepend(mensajeHTML(m));
    var lista = cargar(); lista.unshift(m); guardar(lista.slice(0, 50));
}

function pintarGuardados() {
    var lista = cargar();
    var saludo = { personaje: usuario, texto: PERSONAJES[usuario].saludo, hora: '' };
    timeline.html(mensajeHTML(saludo) + lista.map(mensajeHTML).join(''));
}

function logIn(ingreso) {
    if (ingreso) {
        nuevoBtn.removeClass('oculto'); salirBtn.removeClass('oculto'); notifBtn.removeClass('oculto');
        timeline.removeClass('oculto'); avatarSel.addClass('oculto');
        modalAvatar.attr('src', 'img/avatars/' + usuario + '.jpg');
        pintarGuardados();
    } else {
        nuevoBtn.addClass('oculto'); salirBtn.addClass('oculto'); notifBtn.addClass('oculto');
        timeline.addClass('oculto'); avatarSel.removeClass('oculto');
        titulo.text('Elige tu personaje');
    }
}

avatarBtns.on('click', function () {
    usuario = $(this).data('user');
    titulo.text(PERSONAJES[usuario].nombre);
    logIn(true);
    pedirPermiso();
});
salirBtn.on('click', function () { logIn(false); });

nuevoBtn.on('click', function () {
    modal.removeClass('oculto');
    modal.animate({ marginTop: '-=1000px', opacity: 1 }, 200);
});
cancelarBtn.on('click', function () {
    modal.animate({ marginTop: '+=1000px', opacity: 0 }, 200, function () {
        modal.addClass('oculto'); txtMensaje.val('');
    });
});

postBtn.on('click', function () {
    var texto = txtMensaje.val().trim();
    if (!texto) { cancelarBtn.click(); return; }
    agregarMensaje(usuario, texto);
    notificarMensajeEnviado('Mensaje enviado como ' + PERSONAJES[usuario].nombre, texto);
    cancelarBtn.click();
});

// Notificaciones 
function mostrarNotificacion(titulo, cuerpo, personaje) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    var icono = 'img/avatars/' + (personaje || 'calcifer') + '.jpg';
    var opciones = {
        body: cuerpo,
        icon: icono,
        badge: 'img/icons/icon-72x72.png',
        vibrate: [100, 50, 100],
        tag: 'castillo-' + Date.now(),   // una notificación por mensaje
        renotify: true,
        requireInteraction: true,        // se queda hasta que la veas o la cierres
        timestamp: Date.now()
    };
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(function (reg) {
            return reg.showNotification(titulo, opciones);
        }).catch(function () { try { new Notification(titulo, opciones); } catch (e) {} });
    } else {
        try { new Notification(titulo, opciones); } catch (e) {}
    }
}

function actualizarCampana() {
    if (!('Notification' in window)) { notifBtn.addClass('oculto'); return; }
    notifBtn.toggleClass('activa', Notification.permission === 'granted');
    actualizarEstado();
}

async function pedirPermiso() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
        try { await Notification.requestPermission(); } catch (e) {}
    }
    if (Notification.permission === 'granted') {
        try {
            await registrarSuscripcionPush();
        } catch (error) {
            console.error('No se pudo registrar la suscripción push:', error);
            estado.text('No se pudo conectar al servidor de notificaciones').removeClass('oculto');
        }
    }
    actualizarCampana();
}

notifBtn.on('click', async function () {
    if (!('Notification' in window)) { alert('Este navegador no soporta notificaciones'); return; }
    if (Notification.permission === 'denied') { actualizarCampana(); return; }
    await pedirPermiso();
    if (Notification.permission === 'granted') {
        mostrarNotificacion('El Castillo Ambulante', 'Las notificaciones están activadas.', 'calcifer');
    }
});

// Estado en línea / sin conexión
function actualizarEstado() {
    if (!navigator.onLine) {
        estado.text('Sin conexión: usando la versión guardada en caché').removeClass('oculto');
    } else if ('Notification' in window && Notification.permission === 'denied' && usuario) {
        estado.text('Las notificaciones están bloqueadas: actívalas en el candado de la barra de direcciones').removeClass('oculto');
    } else { estado.addClass('oculto'); }
}
window.addEventListener('online', actualizarEstado);
window.addEventListener('offline', actualizarEstado);
actualizarEstado();

//Service Worker 
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
        navigator.serviceWorker.register('sw.js').catch(function (err) {
            console.log('Error al registrar el SW:', err);
        });
    });
}
