// App GTK4 de teste: janela colorida com contador. Grava em FRAMES_DIR/<titulo>.txt quantos quadros
// o compositor pediu (tick callback só roda quando o compositor manda frame callback).
import Gtk from 'gi://Gtk?version=4.0';
import Gdk from 'gi://Gdk?version=4.0';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

const [title = 'Teste', color = '#3584e4', w = '720', h = '460', appId = '', child = '', lateTitle = ''] = ARGV;
const dir = GLib.getenv('FRAMES_DIR') ?? '/tmp';
const app = new Gtk.Application({
    application_id: appId || `org.stagetest.a${GLib.random_int_range(0, 1e9)}`,
    flags: Gio.ApplicationFlags.NON_UNIQUE,
});
app.connect('activate', () => {
    const win = new Gtk.ApplicationWindow({application: app, title, default_width: +w, default_height: +h});
    const css = new Gtk.CssProvider();
    css.load_from_string(`window{background:${color};} .big{font-size:64px;font-weight:bold;color:white;}`);
    Gtk.StyleContext.add_provider_for_display(Gdk.Display.get_default(), css, 800);
    const box = new Gtk.Box({orientation: Gtk.Orientation.VERTICAL, valign: Gtk.Align.CENTER, halign: Gtk.Align.CENTER});
    const name = new Gtk.Label({label: title, css_classes: ['big']});
    const counter = new Gtk.Label({label: '0', css_classes: ['big']});
    box.append(name); box.append(counter);
    win.set_child(box);
    let frames = 0;
    win.add_tick_callback(() => { frames++; if (frames % 3 === 0) counter.set_label(String(frames)); return GLib.SOURCE_CONTINUE; });
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 200, () => {
        try { GLib.file_set_contents(`${dir}/${title}.txt`, String(frames)); } catch (_e) { /* ignora */ }
        return GLib.SOURCE_CONTINUE;
    });
    win.present();
    if (lateTitle)
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => { win.set_title(lateTitle); return GLib.SOURCE_REMOVE; });
    if (child) {
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1500, () => {
            const d = new Gtk.Window({title: `${title}-dlg`, transient_for: win, default_width: 360, default_height: 200});
            d.set_child(new Gtk.Label({label: 'diálogo de ' + title}));
            d.present();
            return GLib.SOURCE_REMOVE;
        });
    }
});
app.run([]);
