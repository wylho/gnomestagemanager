// SPDX-License-Identifier: GPL-3.0-or-later
// Sondagem do redimensionamento a partir do centro: casos de borda que costumam dar experiência estranha.
import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {winByTitle} from './helpers.js';

const ext = () => Extension.lookupByUUID('stage-manager@wyliam');
const rect = t => winByTitle(t).get_frame_rect();
const keysOf = ctx => { try { return new TextDecoder().decode(GLib.file_get_contents(`${GLib.getenv('SANDBOX_OUT')}/B.keys`)[1]).trim().split('\n').filter(Boolean); } catch (_e) { return []; } };

export default async function (ctx) {
    new Gio.Settings({schema_id: 'org.gnome.desktop.wm.preferences'}).set_string('mouse-button-modifier', '<Control>'); new Gio.Settings({schema_id: 'org.gnome.desktop.wm.preferences'}).set_boolean('resize-with-right-button', true); // o Super virtual não dispara no sandbox
    ext()._settings.set_string('center-resize', 'always');
    ctx.spawn('B', '#26a269', 700, 440); await ctx.waitWin('B'); await ctx.sleep(1500);
    const reset = async () => { winByTitle('B').move_resize_frame(true, 610, 330, 700, 440); await ctx.sleep(500); };
    const state = () => `overview=${Main.overview.visible} modalCount=${Main.modalCount} centerResize=${!!ext()._manager._centerResize} handoff=${!!ext()._manager._handoff}`;

    let escSent = 0, begins = 0;
    const m = ext()._manager, orig = m._pressEscape.bind(m), ob = m._beginCenterResize.bind(m);
    m._pressEscape = () => { escSent++; orig(); };
    m._beginCenterResize = (w, op) => { const r = ob(w, op); if (r) begins++; return r; };
    // P1: clique rápido na borda (apertar e soltar sem arrastar). Nenhuma tecla pode vazar para o app.
    await reset();
    const r0 = rect('B');
    await ctx.key(Clutter.KEY_a); await ctx.sleep(300); // controle: o registrador de teclas do app funciona?
    for (let i = 0; i < 60; i++) {
        ctx.move(r0.x + r0.width + 3, r0.y + r0.height / 2); await ctx.sleep(120);
        ctx.mouseDown(); if (i % 3 === 1) await ctx.sleep(i % 20); else if (i % 3 === 2) await new Promise(r => GLib.idle_add(GLib.PRIORITY_DEFAULT, () => { r(); return GLib.SOURCE_REMOVE; })); ctx.mouseUp(); await ctx.sleep(250);
    }
    const k = keysOf(ctx), r1 = rect('B');
    ctx.log(`P1 esc virtuais=${escSent} gestos assumidos=${begins}; cliques rápidos na borda: teclas recebidas pelo app=${JSON.stringify(k)} tamanho ${r0.width}x${r0.height} -> ${r1.width}x${r1.height}; ${state()}`);

    for (const mode of ['off', 'always']) {
    ext()._settings.set_string('center-resize', mode);
    if (Main.overview.visible) { Main.overview.hide(); await ctx.sleep(800); }
    // P2: Super + botão secundário (redimensionar pelo meio da janela). Deve continuar funcionando.
    await reset();
    const r2 = rect('B');
    ctx.move(r2.x + r2.width - 40, r2.y + r2.height - 40); await ctx.sleep(200);
    ctx.keyDown(Clutter.KEY_Control_L); await ctx.sleep(100);
    ctx.mouseDown(Clutter.BUTTON_SECONDARY); await ctx.sleep(150);
    await ctx.moveSmooth(r2.x + r2.width - 40, r2.y + r2.height - 40, r2.x + r2.width + 60, r2.y + r2.height + 20, 20); await ctx.sleep(200);
    ctx.mouseUp(Clutter.BUTTON_SECONDARY); await ctx.sleep(150);
    ctx.keyUp(Clutter.KEY_Control_L); await ctx.sleep(500);
    const r3 = rect('B');
    ctx.log(`P2[${mode}] Super+botão secundário (+100,+60 de arrasto): ${r2.width}x${r2.height} -> ${r3.width}x${r3.height}; ${state()}`);
    }

    // P3: redimensionar uma janela dentro de um grupo (mosaico) a partir do centro: sem sobreposição, tudo dentro da tela.
    ext()._settings.set_string('center-resize', 'always');
    ctx.spawn('C', '#c01c28', 600, 400); await ctx.waitWin('C'); await ctx.sleep(1500);
    ext()._manager.addRecentToStage(); await ctx.sleep(1500);
    const area = Main.layoutManager.getWorkAreaForMonitor(0);
    const rs = () => ['B', 'C'].map(t => rect(t));
    const ov = ([a, b]) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
    const fmt = r => `${r.width}x${r.height}+${r.x}+${r.y}`;
    const before = rs();
    const c = rect('C');
    const gx = c.x + c.width + 3, gy = c.y + c.height / 2;
    ctx.move(gx, gy); await ctx.sleep(200); ctx.mouseDown(); await ctx.sleep(150);
    await ctx.moveSmooth(gx, gy, gx + 150, gy, 20); await ctx.sleep(200); ctx.mouseUp(); await ctx.sleep(1200);
    const after = rs();
    const inside = after.every(r => r.x >= area.x && r.y >= area.y && r.x + r.width <= area.x + area.width && r.y + r.height <= area.y + area.height);
    ctx.log(`P3 grupo B+C: antes [${before.map(fmt)}] depois [${after.map(fmt)}]; sobrepõe=${ov(after)} dentro=${inside}; C pediu +300 de largura e ficou ${after[1].width - before[1].width >= 0 ? '+' : ''}${after[1].width - before[1].width}`);
}
