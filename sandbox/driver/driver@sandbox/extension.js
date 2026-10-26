// SPDX-License-Identifier: GPL-3.0-or-later
// Extensão-driver (só no sandbox): carrega o roteiro SANDBOX_SCRIPT e expõe helpers.
import GLib from 'gi://GLib';
import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import Shell from 'gi://Shell';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';

Gio._promisify(Shell.Screenshot.prototype, 'screenshot', 'screenshot_finish');

const OUT = GLib.getenv('SANDBOX_OUT');
const HERE = GLib.getenv('SANDBOX_HERE');

function append(path, text) {
    const s = Gio.File.new_for_path(path).append_to(Gio.FileCreateFlags.NONE, null);
    s.write_all(`${text}\n`, null); s.close(null);
}

function makeCtx() {
    const procs = [];
    const seat = Clutter.get_default_backend().get_default_seat();
    const mouse = seat.create_virtual_device(Clutter.InputDeviceType.POINTER_DEVICE);
    const kbd = seat.create_virtual_device(Clutter.InputDeviceType.KEYBOARD_DEVICE);
    const now = () => GLib.get_monotonic_time();
    const ctx = {
        out: OUT,
        log: m => append(`${OUT}/run.log`, String(m)),
        sleep: ms => new Promise(r => GLib.timeout_add(GLib.PRIORITY_DEFAULT, ms, () => { r(); return GLib.SOURCE_REMOVE; })),
        async shot(name, cursor = false) {
            const f = Gio.File.new_for_path(`${OUT}/${name}.png`);
            const st = f.replace(null, false, Gio.FileCreateFlags.NONE, null);
            await new Shell.Screenshot().screenshot(cursor, st);
            st.close(null);
        },
        spawn(title, color = '#3584e4', w = 720, h = 460, appId = '', child = '', lateTitle = '') {
            const l = new Gio.SubprocessLauncher({flags: Gio.SubprocessFlags.NONE});
            l.setenv('GDK_BACKEND', 'wayland', true);
            l.setenv('WAYLAND_DISPLAY', 'wayland-sandbox', true);
            l.setenv('GSK_RENDERER', 'cairo', true);
            l.setenv('FRAMES_DIR', OUT, true);
            const p = l.spawnv(['sh', '-c', `exec gjs -m "${HERE}/testapp/testapp.js" "$0" "$1" "$2" "$3" "$4" "$5" "$6" > "${OUT}/app-${title}.log" 2>&1`, title, color, String(w), String(h), appId, child, lateTitle]);
            procs.push(p);
            return p;
        },
        /** Abre um app real (GTK) dentro do shell de teste. */
        launch(argv, extraEnv = {}) {
            const l = new Gio.SubprocessLauncher({flags: Gio.SubprocessFlags.NONE});
            l.setenv('GDK_BACKEND', 'wayland', true);
            l.setenv('WAYLAND_DISPLAY', 'wayland-sandbox', true);
            l.setenv('GSK_RENDERER', 'cairo', true);
            for (const [k, v] of Object.entries(extraEnv))
                l.setenv(k, v, true);
            const p = l.spawnv(argv);
            procs.push(p);
            return p;
        },
        win(title) {
            return global.get_window_actors().map(a => a.meta_window).find(w => w.get_title() === title);
        },
        async waitWin(title, ms = 20000) {
            const t0 = GLib.get_monotonic_time();
            for (;;) {
                const w = ctx.win(title);
                if (w && w.get_compositor_private()) return w;
                if ((GLib.get_monotonic_time() - t0) / 1000 > ms) throw new Error(`janela "${title}" não apareceu`);
                await ctx.sleep(100);
            }
        },
        frames(title) {
            try { return parseInt(new TextDecoder().decode(GLib.file_get_contents(`${OUT}/${title}.txt`)[1])); } catch (_e) { return -1; }
        },
        move(x, y) { mouse.notify_absolute_motion(now(), x, y); },
        async moveSmooth(x0, y0, x1, y1, steps = 12) {
            for (let i = 1; i <= steps; i++) {
                mouse.notify_absolute_motion(now(), x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps);
                await ctx.sleep(25);
            }
        },
        async click(x, y, {shift = false} = {}) {
            mouse.notify_absolute_motion(now(), x, y); await ctx.sleep(150);
            if (shift) { kbd.notify_keyval(now(), Clutter.KEY_Shift_L, Clutter.KeyState.PRESSED); await ctx.sleep(60); }
            mouse.notify_button(now(), Clutter.BUTTON_PRIMARY, Clutter.ButtonState.PRESSED); await ctx.sleep(80);
            mouse.notify_button(now(), Clutter.BUTTON_PRIMARY, Clutter.ButtonState.RELEASED); await ctx.sleep(80);
            if (shift) kbd.notify_keyval(now(), Clutter.KEY_Shift_L, Clutter.KeyState.RELEASED);
        },
        async key(keyval, times = 1) {
            for (let i = 0; i < times; i++) {
                kbd.notify_keyval(now(), keyval, Clutter.KeyState.PRESSED); await ctx.sleep(30);
                kbd.notify_keyval(now(), keyval, Clutter.KeyState.RELEASED); await ctx.sleep(60);
            }
        },
        async rightClick(x, y) {
            mouse.notify_absolute_motion(now(), x, y); await ctx.sleep(200);
            mouse.notify_button(now(), Clutter.BUTTON_SECONDARY, Clutter.ButtonState.PRESSED); await ctx.sleep(80);
            mouse.notify_button(now(), Clutter.BUTTON_SECONDARY, Clutter.ButtonState.RELEASED); await ctx.sleep(500);
        },
        async drag(x0, y0, x1, y1) {
            mouse.notify_absolute_motion(now(), x0, y0); await ctx.sleep(150);
            mouse.notify_button(now(), Clutter.BUTTON_PRIMARY, Clutter.ButtonState.PRESSED); await ctx.sleep(100);
            await ctx.moveSmooth(x0, y0, x1, y1, 20); await ctx.sleep(200);
            mouse.notify_button(now(), Clutter.BUTTON_PRIMARY, Clutter.ButtonState.RELEASED); await ctx.sleep(300);
        },
        killAll() { for (const p of procs) { try { p.force_exit(); } catch (_e) { /* já saiu */ } } },
    };
    return ctx;
}

export default class Driver extends Extension {
    enable() {
        const script = GLib.getenv('SANDBOX_SCRIPT');
        if (!script) return;
        this._id = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 3, () => {
            (async () => {
                const ctx = makeCtx();
                try {
                    const mod = await import(`file://${script}`);
                    await mod.default(ctx);
                    ctx.log('DONE');
                } catch (e) {
                    ctx.log(`ERROR ${e}\n${e.stack ?? ''}`);
                }
                ctx.killAll();
                global.context.terminate();
            })();
            return GLib.SOURCE_REMOVE;
        });
    }
    disable() { if (this._id) GLib.source_remove(this._id); }
}
