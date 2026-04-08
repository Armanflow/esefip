// ============================================================
// supabase.js — Capa central de API ESEFIP
// Reemplaza: config.php + ajax.php + guardia_ajax.php
// ============================================================

const SUPABASE_URL = 'https://fbipglkpuzcpgveceanc.supabase.co';
const SUPABASE_KEY = 'sb_publishable_DmnnuUFe_6NCj3NGkxG6hQ_IHrrS_64';

const TELEGRAM_BOT  = '7279824834:AAFjsSx9qg9eym1tv2iQFcKvOe7Rv6lPAos';
const TELEGRAM_CHAT = '1425131487';

const STORAGE_URL = `${SUPABASE_URL}/storage/v1/object/public/esefip-uploads/`;

// ============================================================
// HTTP helpers
// ============================================================
async function sbFetch(path, options = {}) {
    const res = await fetch(`${SUPABASE_URL}${path}`, {
        ...options,
        headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            ...(options.headers || {})
        }
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.hint || `HTTP ${res.status}`);
    }
    if (res.status === 204) return null;
    return res.json();
}

async function rpc(fn, params = {}) {
    return sbFetch(`/rest/v1/rpc/${fn}`, { method: 'POST', body: JSON.stringify(params) });
}

async function query(table, params = '') {
    return sbFetch(`/rest/v1/${table}?${params}`);
}

async function insert(table, body) {
    return sbFetch(`/rest/v1/${table}`, {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify(body)
    });
}

async function update(table, body, filter) {
    return sbFetch(`/rest/v1/${table}?${filter}`, {
        method: 'PATCH',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify(body)
    });
}

// ============================================================
// AUTH
// ============================================================
const Auth = {
    save(usuario) { localStorage.setItem('esefip_user', JSON.stringify(usuario)); },
    get() { try { return JSON.parse(localStorage.getItem('esefip_user')); } catch { return null; } },
    logout() {
        localStorage.removeItem('esefip_user');
        const inSub = location.pathname.split('/').filter(Boolean).length > 1;
        location.href = inSub ? '../login.html' : 'login.html';
    },
    requireAdmin() {
        const u = Auth.get();
        if (!u || u.rol !== 'admin') { location.href = '../login.html'; return null; }
        return u;
    },
    requireGuardia() {
        const u = Auth.get();
        if (!u || u.rol !== 'guardia') { location.href = '../login.html'; return null; }
        return u;
    }
};

// ============================================================
// API ADMIN
// ============================================================
const AdminAPI = {
    async login(cedula, password) {
        const rows = await rpc('sp_login', { p_cedula: cedula, p_password: password });
        return rows && rows.length > 0 ? rows[0] : null;
    },
    async dashboard() {
        const rows = await rpc('sp_dashboard_admin');
        return rows[0] ?? {};
    },
    async estadisticasAsistencia(mes, anio) {
        return rpc('sp_estadisticas_asistencia_mes', { p_mes: mes, p_anio: anio });
    },
    async estadisticasRondas(mes, anio) {
        return rpc('sp_estadisticas_rondas_mes', { p_mes: mes, p_anio: anio });
    },
    async listarGuardias() { return rpc('sp_listar_guardias'); },
    async crearGuardia(d) {
        const rows = await rpc('sp_crear_guardia', {
            p_cedula: d.cedula, p_password: d.password, p_nombre: d.nombre,
            p_apellido: d.apellido, p_telefono: d.telefono||'', p_correo: d.correo||'',
            p_turno: d.turno, p_salario: parseFloat(d.salario),
            p_hora_inicio: d.hora_inicio, p_hora_fin: d.hora_fin, p_dias: d.dias_trabajo,
            p_tiene_relevo: parseInt(d.tiene_relevo), p_relevo_id: parseInt(d.relevo_id)||0,
            p_rondas_req: parseInt(d.rondas_requeridas)||0
        });
        const row = rows?.[0] ?? {};
        return { success: row.resultado > 0, data: row, message: row.mensaje||'' };
    },
    async actualizarGuardia(d) {
        await rpc('sp_actualizar_guardia', {
            p_id: parseInt(d.id), p_nombre: d.nombre, p_apellido: d.apellido,
            p_telefono: d.telefono||'', p_correo: d.correo||'', p_turno: d.turno,
            p_salario: parseFloat(d.salario), p_activo: parseInt(d.activo??1),
            p_hora_inicio: d.hora_inicio, p_hora_fin: d.hora_fin, p_dias: d.dias_trabajo,
            p_tiene_relevo: parseInt(d.tiene_relevo), p_relevo_id: parseInt(d.relevo_id)||0,
            p_rondas_req: parseInt(d.rondas_requeridas)||0
        });
        return { success: true, message: 'Guardia actualizado' };
    },
    async eliminarGuardia(id) {
        await rpc('sp_eliminar_guardia', { p_id: parseInt(id) });
        return { success: true, message: 'Guardia desactivado' };
    },
    async listarAsistencias(desde, hasta, guardiaId=null) {
        return rpc('sp_listar_asistencias_admin', {
            p_fecha_inicio: desde, p_fecha_fin: hasta, p_usuario_id: guardiaId||null
        });
    },
    async listarRondas(desde, hasta, guardiaId=null) {
        return rpc('sp_listar_rondas_admin', {
            p_fecha_inicio: desde, p_fecha_fin: hasta, p_usuario_id: guardiaId||null
        });
    },
    async subsanarRonda(rondaId) {
        await rpc('sp_subsanar_ronda', { p_ronda_id: parseInt(rondaId) });
        return { success: true, message: 'Ronda subsanada' };
    },
    async listarPagos(mes, anio) {
        return rpc('sp_listar_pagos_admin', { p_mes: mes, p_anio: anio });
    },
    async resumenDescuentos(mes, anio) {
        return rpc('sp_resumen_descuentos_mes', { p_mes: mes, p_anio: anio });
    },
    async detalleDescuentos(usuarioId, mes, anio) {
        return rpc('sp_detalle_descuentos', {
            p_usuario_id: parseInt(usuarioId), p_mes: mes, p_anio: anio
        });
    },
    async generarPagos(mes, anio) {
        const r = await rpc('sp_generar_pagos_mes', { p_mes: mes, p_anio: anio });
        return { success: true, data: r };
    },
    async marcarPago(pagoId, bonos, descuentos, observaciones, adminId) {
        const rows = await rpc('sp_marcar_pago', {
            p_pago_id: parseInt(pagoId), p_bonos: parseFloat(bonos),
            p_descuentos: parseFloat(descuentos), p_observaciones: observaciones||'',
            p_admin_id: parseInt(adminId)
        });
        const pago = rows?.[0] ?? null;
        if (pago) {
            update('pagos', { telegram_enviado: 1 }, `id=eq.${pago.id}`);
            Telegram.sendMessage(
                `💰 <b>PAGO PROCESADO — ESEFIP</b>\n\n` +
                `👤 ${pago.nombre} ${pago.apellido} | 🪪 ${pago.cedula}\n` +
                `📅 ${nombreMes(pago.mes)} ${pago.anio}\n` +
                `💵 Base: Bs ${parseFloat(pago.salario_base).toFixed(2)}\n` +
                `➕ Bonos: Bs ${parseFloat(pago.bonos).toFixed(2)}\n` +
                `➖ Descuentos: Bs ${parseFloat(pago.descuentos).toFixed(2)}\n` +
                `✅ <b>TOTAL: Bs ${parseFloat(pago.total).toFixed(2)}</b>\n` +
                `📋 ${pago.observaciones||'Sin observaciones'}\n` +
                `👨‍💼 Aprobado por: ${pago.admin_nombre} ${pago.admin_apellido}`
            );
        }
        return { success: true, data: pago, message: 'Pago procesado' };
    },
    async listarQR() { return rpc('sp_listar_puntos_qr'); },
    async crearQR(codigo, edificio, piso, zona, descripcion) {
        const id = await rpc('sp_crear_punto_qr', {
            p_codigo: codigo, p_edificio: edificio,
            p_piso: piso, p_zona: zona, p_descripcion: descripcion||''
        });
        return { success: true, data: { resultado: id } };
    },
    async reporteGeneral(mes, anio) {
        return rpc('sp_reporte_general', { p_mes: mes, p_anio: anio });
    },
    async listarNovedades() {
        const rows = await query('novedades',
            'select=*,usuarios(nombre,apellido,cedula)&order=creado_en.desc&limit=100'
        );
        return rows.map(n => ({ ...n, nombre: n.usuarios?.nombre,
            apellido: n.usuarios?.apellido, cedula: n.usuarios?.cedula }));
    },
    async marcarNovedadVista(id) {
        await update('novedades', { vista: 1 }, `id=eq.${id}`);
        return { success: true };
    }
};

// ============================================================
// API GUARDIA
// ============================================================
const GuardiaAPI = {
    async asistenciasHoy(uid) {
        return rpc('sp_asistencias_hoy_guardia', { p_usuario_id: uid });
    },
    async registrarAsistencia(uid, tipo, gps, metodo, fotoBlob, dispositivo) {
        let fotoPath = null;
        if (fotoBlob) {
            fotoPath = await Storage.upload(
                `asistencias/asist_${uid}_${Date.now()}_${tipo}.jpg`, fotoBlob, 'image/jpeg'
            );
        }
        const nuevoId = await rpc('sp_registrar_asistencia', {
            p_usuario_id: uid, p_tipo: tipo,
            p_latitud: gps.lat||null, p_longitud: gps.lon||null,
            p_direccion: gps.direccion||'', p_zona: gps.zona||'',
            p_ciudad: gps.ciudad||'', p_pais: gps.pais||'',
            p_precision: gps.precision||null, p_altitud: gps.altitud||null,
            p_metodo: metodo, p_foto: fotoPath, p_dispositivo: dispositivo
        });
        if (nuevoId) update('asistencias', { telegram_enviado: 1 }, `id=eq.${nuevoId}`);
        return { success: true, data: { id: nuevoId, foto: fotoPath } };
    },
    async rondasHoy(uid) {
        return rpc('sp_rondas_hoy_guardia', { p_usuario_id: uid });
    },
    async registrarRonda(uid, datos, dispositivo) {
        const nuevoId = await rpc('sp_registrar_ronda', {
            p_usuario_id: uid, p_edificio: datos.edificio,
            p_piso: datos.piso||'', p_zona: datos.zona||'',
            p_qr_id: datos.qr_id||'', p_metodo: datos.metodo||'camara',
            p_latitud: datos.lat||null, p_longitud: datos.lon||null,
            p_dispositivo: dispositivo
        });
        if (nuevoId) update('rondas', { telegram_enviado: 1 }, `id=eq.${nuevoId}`);
        return { success: true, data: { id: nuevoId } };
    },
    async historialPagos(uid) {
        return query('pagos', `usuario_id=eq.${uid}&order=anio.desc,mes.desc&limit=12&select=*`);
    },
    async pagoMes(uid, mes, anio) {
        const rows = await rpc('sp_pago_mes_guardia', {
            p_usuario_id: uid, p_mes: mes, p_anio: anio
        });
        return rows?.[0] ?? null;
    },
    async registrarNovedad(uid, descripcion, gps, fotoBlob, audioBlob, nombre, cedula) {
        let fotoPath = null, audioPath = null;
        if (fotoBlob)  fotoPath  = await Storage.upload(`novedades/nov_${uid}_${Date.now()}.jpg`,  fotoBlob,  'image/jpeg');
        if (audioBlob) audioPath = await Storage.upload(`novedades/nov_audio_${uid}_${Date.now()}.webm`, audioBlob, 'audio/webm');

        const rows = await insert('novedades', {
            usuario_id: uid, descripcion: descripcion||'',
            foto_path: fotoPath, audio_path: audioPath,
            lat: gps.lat||null, lon: gps.lon||null,
            zona: gps.zona||'', ciudad: gps.ciudad||'', telegram_enviado: 1
        });
        const now = new Date().toLocaleString('es-ES');
        const msg =
            `⚠️ <b>NOVEDAD — ESEFIP</b>\n\n👤 ${nombre} | 🪪 ${cedula}\n⏰ ${now}\n` +
            (gps.zona ? `📍 ${gps.zona}, ${gps.ciudad}\n` : '') +
            (gps.lat  ? `🗺️ ${gps.lat}, ${gps.lon}\n` : '') +
            (descripcion ? `\n📝 ${descripcion}` : '');
        if (fotoBlob) await Telegram.sendPhoto(fotoBlob, msg);
        else await Telegram.sendMessage(msg);
        if (audioBlob) await Telegram.sendAudio(audioBlob, `🎙️ Nota de voz — ${nombre}`);
        return { success: true, data: { id: rows?.[0]?.id } };
    }
};

// ============================================================
// STORAGE
// ============================================================
const Storage = {
    async upload(path, blob, mimeType) {
        const res = await fetch(`${SUPABASE_URL}/storage/v1/object/esefip-uploads/${path}`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': mimeType, 'x-upsert': 'true'
            },
            body: blob
        });
        if (!res.ok) { console.error('Storage upload failed'); return null; }
        return path;
    },
    url(path) { return path ? `${STORAGE_URL}${path}` : null; }
};

// ============================================================
// TELEGRAM
// ============================================================
const Telegram = {
    async sendMessage(text) {
        return fetch(`https://api.telegram.org/bot${TELEGRAM_BOT}/sendMessage`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: TELEGRAM_CHAT, text, parse_mode: 'HTML' })
        }).catch(() => {});
    },
    async sendPhoto(blob, caption) {
        const fd = new FormData();
        fd.append('chat_id', TELEGRAM_CHAT); fd.append('photo', blob, 'foto.jpg');
        fd.append('caption', caption); fd.append('parse_mode', 'HTML');
        return fetch(`https://api.telegram.org/bot${TELEGRAM_BOT}/sendPhoto`, {
            method: 'POST', body: fd
        }).catch(() => {});
    },
    async sendAudio(blob, caption) {
        const fd = new FormData();
        fd.append('chat_id', TELEGRAM_CHAT); fd.append('audio', blob, 'audio.webm');
        fd.append('caption', caption);
        return fetch(`https://api.telegram.org/bot${TELEGRAM_BOT}/sendAudio`, {
            method: 'POST', body: fd
        }).catch(() => {});
    }
};

// ============================================================
// HELPERS
// ============================================================
function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleString('es-ES', {
        day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'
    });
}
function nombreMes(m) {
    return ['','Enero','Febrero','Marzo','Abril','Mayo','Junio',
            'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][m]||'';
}
function dataURLtoBlob(dataURL) {
    const [h, d] = dataURL.split(',');
    const mime = h.match(/:(.*?);/)[1];
    const bin  = atob(d);
    const arr  = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
}
function getDeviceId() {
    let id = localStorage.getItem('esefip_device_id');
    if (!id) { id = 'DEV_' + Date.now() + '_' + Math.random().toString(36).slice(2,11); localStorage.setItem('esefip_device_id', id); }
    return id;
}
