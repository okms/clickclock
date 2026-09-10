//! Renders the tray icon as RGBA pixels (TRAY-09..TRAY-11).
//!
//! The tray shows either today's total as decimal-hour text or a plain
//! clock glyph, with an optional pause/stop overlay at ~50% opacity on top.
//! Everything is drawn in black on a transparent background so macOS can
//! treat the image as a template (it recolors black-on-transparent to match
//! light/dark menu bars; see `icon_as_template` in `lib.rs`).
//!
//! Drawing happens in two passes on the same [`tiny_skia::Pixmap`]:
//! 1. content (text or the clock glyph),
//! 2. the overlay, painted afterwards so it sits on top.
//!
//! Because every shape drawn here is pure black, a pixel's premultiplied
//! and straight-alpha representations are identical (color * anything = 0),
//! so the pixmap's raw byte buffer can be returned as straight RGBA with no
//! extra unpremultiply step.
//!
//! Text is not rasterized by `ab_glyph`'s built-in coverage renderer.
//! Instead, each glyph's raw outline curves are read from the font (unscaled,
//! y-up, in font design units) and converted into a `tiny-skia` vector path
//! placed at the glyph's pen position, which is then filled *and* stroked
//! (see `outline_to_path`). Stroking on top of the fill fakes a heavier
//! weight than the variable font's default (400) instance offers, which
//! reads too light in a real menu bar.

use ab_glyph::{Font, FontRef, Outline, OutlineCurve, PxScale, ScaleFont};
use tiny_skia::{FillRule, LineCap, LineJoin, Paint, PathBuilder, Pixmap, Stroke, Transform};

const FONT_BYTES: &[u8] = include_bytes!("../fonts/SchibstedGrotesk-Variable.ttf");

/// What (if anything) is overlaid on top of the tray content (TRAY-11).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Overlay {
    None,
    Pause,
    Stop,
}

/// Straight (non-premultiplied) RGBA pixels, row-major, top-left origin.
pub struct Rendered {
    pub width: u32,
    pub height: u32,
    pub rgba: Vec<u8>,
}

/// Parses the `overlay` string argument of the `set_tray` command.
/// Unrecognised values (including "none") render no overlay.
pub fn parse_overlay(s: &str) -> Overlay {
    match s {
        "pause" => Overlay::Pause,
        "stop" => Overlay::Stop,
        _ => Overlay::None,
    }
}

/// Renders the tray image.
///
/// `scale` 2 means Retina; the image height is always `22 * scale` px.
/// - `text` `Some(s)`: draws `s` in the bundled font at `17 * scale` px
///   (matched to look like 13pt system text, since this font's cap height
///   is ~0.7 em), black, emboldened past the font's default weight, with
///   `2 * scale` px of left padding and `6 * scale` px of right padding (the
///   extra room the overlay sits in); the image is only as wide as the text
///   needs (TRAY-09). It is vertically centred on the drawn glyphs' own ink
///   bounds (roughly their cap height), not the font's full em box.
/// - `text` `None`: draws a clock glyph (circle + minute hand pointing up +
///   hour hand at two o'clock) inside a `22 * scale` px square (TRAY-10).
/// - `overlay`: drawn after the content, so it sits on top of it, at about
///   50% black opacity, its right edge inset `1 * scale` px from the image's
///   right edge, vertically centred, overlapping roughly the right half of
///   the last digit (or the clock's right side) (TRAY-11).
pub fn render(text: Option<&str>, overlay: Overlay, scale: u32) -> Rendered {
    let scale_f = scale as f32;
    let height = 22 * scale;

    let pixmap = match text {
        Some(s) => {
            // Beside the digits: reserve gap + glyph width on the right (TRAY-11).
            let extra = if overlay == Overlay::None {
                0.0
            } else {
                TEXT_GLYPH_GAP * scale_f + overlay_width(overlay, scale_f)
            };
            let mut pm = render_text(s, scale_f, height, extra);
            draw_overlay(&mut pm, overlay, scale_f, 2.0 * scale_f);
            pm
        }
        None => {
            let mut pm = render_clock(scale_f, height);
            draw_overlay(&mut pm, overlay, scale_f, 1.0 * scale_f);
            pm
        }
    };

    Rendered {
        width: pixmap.width(),
        height: pixmap.height(),
        rgba: pixmap.data().to_vec(),
    }
}

/// Converts one glyph's raw outline (unscaled, unpositioned, y-up font
/// design units) into an absolute-coordinate `tiny-skia` path: each point is
/// scaled by `(h, v)` and placed relative to `(pos_x, pos_y)` (the glyph's
/// pen position, i.e. `(cursor_x, baseline_y)`). The vertical axis is
/// flipped because font outlines are y-up and the canvas is y-down.
///
/// `ab_glyph::OutlineCurve`s do not mark contour boundaries explicitly: a
/// new contour starts whenever a segment's start point does not match the
/// previous segment's end point. Each contour is explicitly `close()`d so
/// that a subsequent stroke (used to embolden the glyph) forms an unbroken
/// loop instead of leaving a seam.
fn outline_to_path(outline: &Outline, h: f32, v: f32, pos_x: f32, pos_y: f32) -> Option<tiny_skia::Path> {
    let to_xy = |p: ab_glyph::Point| (pos_x + p.x * h, pos_y - p.y * v);

    let mut pb = PathBuilder::new();
    let mut last: Option<(f32, f32)> = None;
    let mut subpath_open = false;

    for curve in &outline.curves {
        let start = match *curve {
            OutlineCurve::Line(p0, _) => p0,
            OutlineCurve::Quad(p0, _, _) => p0,
            OutlineCurve::Cubic(p0, _, _, _) => p0,
        };
        let start_xy = to_xy(start);
        if last != Some(start_xy) {
            if subpath_open {
                pb.close();
            }
            pb.move_to(start_xy.0, start_xy.1);
            subpath_open = true;
        }

        last = Some(match *curve {
            OutlineCurve::Line(_, p1) => {
                let (x, y) = to_xy(p1);
                pb.line_to(x, y);
                (x, y)
            }
            OutlineCurve::Quad(_, p1, p2) => {
                let (cx, cy) = to_xy(p1);
                let (x, y) = to_xy(p2);
                pb.quad_to(cx, cy, x, y);
                (x, y)
            }
            OutlineCurve::Cubic(_, p1, p2, p3) => {
                let (c1x, c1y) = to_xy(p1);
                let (c2x, c2y) = to_xy(p2);
                let (x, y) = to_xy(p3);
                pb.cubic_to(c1x, c1y, c2x, c2y, x, y);
                (x, y)
            }
        });
    }
    if subpath_open {
        pb.close();
    }

    pb.finish()
}

/// Lays out `s` in the embedded font at `17 * scale` px, returning a pixmap
/// sized to fit it with `2 * scale` px of padding on the left and
/// `2 * scale + 4 * scale` px on the right (extra room for the overlay).
fn render_text(s: &str, scale: f32, height: u32, extra_right: f32) -> Pixmap {
    let font = FontRef::try_from_slice(FONT_BYTES).expect("embedded font is valid");
    let px_size = 17.0 * scale;
    let scaled_font = font.as_scaled(PxScale::from(px_size));
    let left_padding = 2.0 * scale;
    let right_padding = 2.0 * scale + extra_right;
    let factor = scaled_font.scale_factor();

    // First pass: measure the total advance (canvas width).
    let mut advance = 0.0f32;
    let mut prev_id = None;
    for ch in s.chars() {
        let id = font.glyph_id(ch);
        if let Some(prev) = prev_id {
            advance += scaled_font.kern(prev, id);
        }
        advance += scaled_font.h_advance(id);
        prev_id = Some(id);
    }

    let width = ((left_padding + right_padding + advance).ceil() as u32).max(1);
    let mut pixmap = Pixmap::new(width, height).expect("non-zero tray image size");

    let mut paint = Paint::default();
    paint.set_color_rgba8(0, 0, 0, 255);
    paint.anti_alias = true;

    // Stroking the same outline the fill uses fakes a heavier weight than
    // the variable font's default (400) instance, which reads too light in
    // a real menu bar.
    let mut stroke = Stroke::default();
    stroke.width = 0.55 * scale;
    stroke.line_join = LineJoin::Round;

    // Second pass: build every glyph path on a baseline at y = 0, then shift
    // them all so the ink's own bounding box (roughly the cap height, since
    // the text is digits) is centred in the image. Working from the mapped
    // path bounds keeps this independent of the font's y-axis convention.
    let mut paths = Vec::new();
    let mut cursor_x = left_padding;
    let mut prev_id = None;
    for ch in s.chars() {
        let id = font.glyph_id(ch);
        if let Some(prev) = prev_id {
            cursor_x += scaled_font.kern(prev, id);
        }
        if let Some(outline) = font.outline(id) {
            if let Some(path) = outline_to_path(&outline, factor.horizontal, factor.vertical, cursor_x, 0.0) {
                paths.push(path);
            }
        }
        cursor_x += scaled_font.h_advance(id);
        prev_id = Some(id);
    }
    let (mut ink_top, mut ink_bottom) = (f32::MAX, f32::MIN);
    for path in &paths {
        let b = path.bounds();
        ink_top = ink_top.min(b.top());
        ink_bottom = ink_bottom.max(b.bottom());
    }
    let dy = if paths.is_empty() { 0.0 } else { height as f32 / 2.0 - (ink_top + ink_bottom) / 2.0 };
    let shift = Transform::from_translate(0.0, dy);
    for path in &paths {
        pixmap.fill_path(path, &paint, FillRule::Winding, shift, None);
        pixmap.stroke_path(path, &paint, &stroke, shift, None);
    }

    pixmap
}

/// Draws the plain clock glyph (no timer text) into a `22 * scale` px
/// square: a circle stroke, a minute hand pointing straight up, and a
/// shorter hour hand pointing at two o'clock.
fn render_clock(scale: f32, height: u32) -> Pixmap {
    let size = height;
    let mut pixmap = Pixmap::new(size, size).expect("non-zero tray image size");

    let stroke_width = 1.8 * scale;
    let center_x = size as f32 / 2.0;
    let center_y = size as f32 / 2.0;
    let radius = size as f32 / 2.0 - stroke_width - 1.0 * scale;

    let mut paint = Paint::default();
    paint.set_color_rgba8(0, 0, 0, 255);
    paint.anti_alias = true;

    let mut stroke = Stroke::default();
    stroke.width = stroke_width;
    stroke.line_cap = LineCap::Round;

    // Circle face.
    if let Some(circle) = PathBuilder::from_circle(center_x, center_y, radius) {
        pixmap.stroke_path(&circle, &paint, &stroke, Transform::identity(), None);
    }

    // Minute hand: straight up from the center.
    let minute_len = radius * 0.75;
    let mut pb = PathBuilder::new();
    pb.move_to(center_x, center_y);
    pb.line_to(center_x, center_y - minute_len);
    if let Some(path) = pb.finish() {
        pixmap.stroke_path(&path, &paint, &stroke, Transform::identity(), None);
    }

    // Hour hand: shorter, pointing at two o'clock (60 degrees clockwise
    // from straight up).
    let hour_len = radius * 0.45;
    let angle = 60f32.to_radians();
    let hour_x = center_x + hour_len * angle.sin();
    let hour_y = center_y - hour_len * angle.cos();
    let mut pb = PathBuilder::new();
    pb.move_to(center_x, center_y);
    pb.line_to(hour_x, hour_y);
    if let Some(path) = pb.finish() {
        pixmap.stroke_path(&path, &paint, &stroke, Transform::identity(), None);
    }

    pixmap
}

/// Builds a rounded-rectangle path, used for the stop-glyph overlay.
fn rounded_rect_path(x: f32, y: f32, w: f32, h: f32, r: f32) -> Option<tiny_skia::Path> {
    let mut pb = PathBuilder::new();
    pb.move_to(x + r, y);
    pb.line_to(x + w - r, y);
    pb.quad_to(x + w, y, x + w, y + r);
    pb.line_to(x + w, y + h - r);
    pb.quad_to(x + w, y + h, x + w - r, y + h);
    pb.line_to(x + r, y + h);
    pb.quad_to(x, y + h, x, y + h - r);
    pb.line_to(x, y + r);
    pb.quad_to(x, y, x + r, y);
    pb.close();
    pb.finish()
}

/// Paints the pause/stop overlay over the right end of whatever content is
/// already on `pixmap`, at ~50% black opacity (TRAY-11). Drawn last so it
/// sits on top of the content. Same geometry regardless of whether the
/// content is text or the clock icon: only `pixmap`'s final dimensions
/// matter, so it lands over the right side of either.
/// Width of the overlay glyph in px, so text mode can reserve room beside the digits.
fn overlay_width(overlay: Overlay, scale: f32) -> f32 {
    match overlay {
        Overlay::Pause => 2.4 * scale * 2.0 + 2.2 * scale,
        Overlay::Stop => 9.0 * scale,
        Overlay::None => 0.0,
    }
}

/// Gap between the digits and the glyph in text mode (TRAY-11: beside, not over).
const TEXT_GLYPH_GAP: f32 = 3.0;

fn draw_overlay(pixmap: &mut Pixmap, overlay: Overlay, scale: f32, right_inset: f32) {
    if overlay == Overlay::None {
        return;
    }

    let width = pixmap.width() as f32;
    let height = pixmap.height() as f32;

    let mut paint = Paint::default();
    paint.set_color_rgba8(0, 0, 0, 128); // ~50% opacity black.
    paint.anti_alias = true;

    match overlay {
        Overlay::Pause => {
            let glyph_height = 11.0 * scale;
            let bar_width = 2.4 * scale;
            let gap = 2.2 * scale;
            let total_width = bar_width * 2.0 + gap;
            let top = (height - glyph_height) / 2.0;
            let right_x = width - right_inset;
            let left_x = right_x - total_width;

            let mut stroke = Stroke::default();
            stroke.width = bar_width;
            stroke.line_cap = LineCap::Round;

            for bar in 0..2 {
                let x = left_x + bar_width / 2.0 + (bar as f32) * (bar_width + gap);
                let mut pb = PathBuilder::new();
                pb.move_to(x, top + bar_width / 2.0);
                pb.line_to(x, top + glyph_height - bar_width / 2.0);
                if let Some(path) = pb.finish() {
                    pixmap.stroke_path(&path, &paint, &stroke, Transform::identity(), None);
                }
            }
        }
        Overlay::Stop => {
            let side = 9.0 * scale;
            let top = (height - side) / 2.0;
            let right_x = width - right_inset;
            let left_x = right_x - side;
            if let Some(path) = rounded_rect_path(left_x, top, side, side, 1.5 * scale) {
                pixmap.fill_path(&path, &paint, FillRule::Winding, Transform::identity(), None);
            }
        }
        Overlay::None => {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn alpha_at(r: &Rendered, x: u32, y: u32) -> u8 {
        let idx = ((y * r.width + x) * 4) as usize;
        r.rgba[idx + 3]
    }

    fn pixel_at(r: &Rendered, x: u32, y: u32) -> (u8, u8, u8, u8) {
        let idx = ((y * r.width + x) * 4) as usize;
        (r.rgba[idx], r.rgba[idx + 1], r.rgba[idx + 2], r.rgba[idx + 3])
    }

    #[test]
    fn tray_09_text_renders_wider_than_tall_and_template_black() {
        let r = render(Some("7.50"), Overlay::None, 2);
        assert_eq!(r.height, 44, "height must always be 22 * scale");
        assert!(r.width > 44, "text tray image should be wider than the fixed clock square");
        assert_eq!(r.rgba.len(), (r.width * r.height * 4) as usize);

        let mut saw_opaque_ish = false;
        for chunk in r.rgba.chunks_exact(4) {
            let (red, green, blue, alpha) = (chunk[0], chunk[1], chunk[2], chunk[3]);
            if alpha > 0 {
                saw_opaque_ish = true;
                assert_eq!((red, green, blue), (0, 0, 0), "template pixels must be pure black");
            }
        }
        assert!(saw_opaque_ish, "text should have drawn some visible pixels");
    }

    #[test]
    fn tray_10_clock_glyph_is_a_fixed_square() {
        let r = render(None, Overlay::None, 2);
        assert_eq!(r.width, 44);
        assert_eq!(r.height, 44);
        let has_opaque = r.rgba.chunks_exact(4).any(|c| c[3] > 0);
        assert!(has_opaque, "clock glyph should draw visible pixels");
    }

    #[test]
    fn tray_11_pause_glyph_sits_beside_the_digits() {
        let base = render(Some("7.50"), Overlay::None, 2);
        let paused = render(Some("7.50"), Overlay::Pause, 2);
        assert_eq!(base.height, paused.height);
        // Room is added to the right for gap + glyph; the digits themselves are untouched.
        assert!(paused.width > base.width, "paused render must be wider to fit the glyph");
        let digits_right = base.width - 2 * 2; // base right padding is 2 * scale
        let mut digits_identical = true;
        let mut saw_glyph_alpha = false;
        for y in 0..base.height {
            for x in 0..paused.width {
                let b = pixel_at(&paused, x, y);
                if x < digits_right {
                    if pixel_at(&base, x, y) != b {
                        digits_identical = false;
                    }
                } else if x >= base.width {
                    let (_, _, _, alpha_b) = b;
                    if (100..=160).contains(&alpha_b) {
                        saw_glyph_alpha = true;
                    }
                }
            }
        }
        assert!(digits_identical, "digits must be unchanged by the glyph");
        assert!(saw_glyph_alpha, "expected ~50% glyph alpha (100..=160) beside the digits");
    }

    #[test]
    fn tray_11_stop_overlay_differs_from_plain_clock() {
        let base = render(None, Overlay::None, 2);
        let stopped = render(None, Overlay::Stop, 2);
        assert_eq!(base.rgba.len(), stopped.rgba.len());
        assert_ne!(base.rgba, stopped.rgba, "stop overlay must change the rendered pixels");
    }

    #[test]
    fn parse_overlay_maps_known_and_unknown_strings() {
        assert_eq!(parse_overlay("pause"), Overlay::Pause);
        assert_eq!(parse_overlay("stop"), Overlay::Stop);
        assert_eq!(parse_overlay("none"), Overlay::None);
        assert_eq!(parse_overlay("garbage"), Overlay::None);
    }

    #[test]
    fn render_empty_text_does_not_panic() {
        let r = render(Some(""), Overlay::None, 2);
        assert!(r.width >= 4);
        assert_eq!(r.height, 44);
    }

    #[test]
    fn debug_write_sample_pngs() {
        let paused = render(Some("7.50"), Overlay::Pause, 2);
        let pixmap = Pixmap::from_vec(
            paused.rgba.clone(),
            tiny_skia::IntSize::from_wh(paused.width, paused.height).unwrap(),
        )
        .expect("valid pixmap for debug PNG");
        pixmap
            .save_png("/tmp/clickclock-tray-pause.png")
            .expect("write debug PNG");

        let stopped = render(None, Overlay::Stop, 2);
        let pixmap = Pixmap::from_vec(
            stopped.rgba.clone(),
            tiny_skia::IntSize::from_wh(stopped.width, stopped.height).unwrap(),
        )
        .expect("valid pixmap for debug PNG");
        pixmap
            .save_png("/tmp/clickclock-tray-stop.png")
            .expect("write debug PNG");

        // Sanity: alpha_at / pixel_at are used above; touch them here too so
        // clippy doesn't flag them as test-only dead code in this module.
        let _ = alpha_at(&paused, 0, 0);
    }
}
