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

use ab_glyph::{Font, FontRef, PxScale, ScaleFont};
use tiny_skia::{LineCap, Paint, PathBuilder, Pixmap, PremultipliedColorU8, Stroke, Transform};

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
/// - `text` `Some(s)`: draws `s` in the bundled font at `14 * scale` px,
///   black, vertically centred, with `2 * scale` px of side padding; the
///   image is only as wide as the text needs (TRAY-09).
/// - `text` `None`: draws a clock glyph (circle + minute hand pointing up +
///   hour hand at two o'clock) inside a `22 * scale` px square (TRAY-10).
/// - `overlay`: drawn after the content, so it sits on top of it, at about
///   50% black opacity, positioned over the right end of the content with a
///   `1 * scale` px inset from the right edge, vertically centred (TRAY-11).
pub fn render(text: Option<&str>, overlay: Overlay, scale: u32) -> Rendered {
    let scale_f = scale as f32;
    let height = 22 * scale;

    let mut pixmap = match text {
        Some(s) => render_text(s, scale_f, height),
        None => render_clock(scale_f, height),
    };

    draw_overlay(&mut pixmap, overlay, scale_f);

    Rendered {
        width: pixmap.width(),
        height: pixmap.height(),
        rgba: pixmap.data().to_vec(),
    }
}

/// Blends a black pixel of the given coverage (0..1) into `pixmap` at
/// `(x, y)` using standard "source over" alpha compositing. Because both
/// the existing and incoming color are always black, only the alpha
/// channel actually changes.
fn blend_black(pixmap: &mut Pixmap, x: i32, y: i32, coverage: f32) {
    if coverage <= 0.0 {
        return;
    }
    let width = pixmap.width() as i32;
    let height = pixmap.height() as i32;
    if x < 0 || y < 0 || x >= width || y >= height {
        return;
    }
    let idx = (y * width + x) as usize;
    let pixels = pixmap.pixels_mut();
    let old_a = pixels[idx].alpha() as f32;
    let src_a = (coverage.clamp(0.0, 1.0) * 255.0).round();
    let new_a = (src_a + old_a * (255.0 - src_a) / 255.0).round().clamp(0.0, 255.0) as u8;
    // Safe: r = g = b = 0 always satisfies the premultiplied invariant.
    pixels[idx] = PremultipliedColorU8::from_rgba(0, 0, 0, new_a).unwrap();
}

/// Lays out `s` in the embedded font at `14 * scale` px, returning a pixmap
/// sized to fit it with `2 * scale` px of padding on each side.
fn render_text(s: &str, scale: f32, height: u32) -> Pixmap {
    let font = FontRef::try_from_slice(FONT_BYTES).expect("embedded font is valid");
    let px_size = 14.0 * scale;
    let scaled_font = font.as_scaled(PxScale::from(px_size));
    let padding = 2.0 * scale;

    // First pass: measure the total advance so we know how wide to make
    // the canvas.
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

    let width = ((padding * 2.0 + advance).ceil() as u32).max(1);
    let mut pixmap = Pixmap::new(width, height).expect("non-zero tray image size");

    // Vertically centre the font's ascent/descent box within the image.
    let ascent = scaled_font.ascent();
    let descent = scaled_font.descent();
    let text_block_height = ascent - descent;
    let top = (height as f32 - text_block_height) / 2.0;
    let baseline_y = top + ascent;

    let mut cursor_x = padding;
    let mut prev_id = None;
    for ch in s.chars() {
        let id = font.glyph_id(ch);
        if let Some(prev) = prev_id {
            cursor_x += scaled_font.kern(prev, id);
        }
        let glyph = id.with_scale_and_position(px_size, ab_glyph::point(cursor_x, baseline_y));
        if let Some(outlined) = font.outline_glyph(glyph) {
            let bounds = outlined.px_bounds();
            let origin_x = bounds.min.x.round() as i32;
            let origin_y = bounds.min.y.round() as i32;
            outlined.draw(|gx, gy, coverage| {
                blend_black(&mut pixmap, origin_x + gx as i32, origin_y + gy as i32, coverage);
            });
        }
        cursor_x += scaled_font.h_advance(id);
        prev_id = Some(id);
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
/// sits on top of the content.
fn draw_overlay(pixmap: &mut Pixmap, overlay: Overlay, scale: f32) {
    if overlay == Overlay::None {
        return;
    }

    let width = pixmap.width() as f32;
    let height = pixmap.height() as f32;
    let glyph_height = 9.0 * scale;
    let right_inset = 1.0 * scale;
    let top = (height - glyph_height) / 2.0;

    let mut paint = Paint::default();
    paint.set_color_rgba8(0, 0, 0, 128); // ~50% opacity black.
    paint.anti_alias = true;

    match overlay {
        Overlay::Pause => {
            let bar_width = 2.2 * scale;
            let gap = 2.0 * scale;
            let total_width = bar_width * 2.0 + gap;
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
            let side = glyph_height;
            let right_x = width - right_inset;
            let left_x = right_x - side;
            if let Some(path) = rounded_rect_path(left_x, top, side, side, 1.5 * scale) {
                pixmap.fill_path(
                    &path,
                    &paint,
                    tiny_skia::FillRule::Winding,
                    Transform::identity(),
                    None,
                );
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
    fn tray_11_pause_overlay_only_touches_right_third_of_text() {
        let base = render(Some("7.50"), Overlay::None, 2);
        let paused = render(Some("7.50"), Overlay::Pause, 2);
        assert_eq!(base.width, paused.width);
        assert_eq!(base.height, paused.height);

        let third = base.width / 3;
        let mut left_identical = true;
        let mut differs_in_right_third = false;
        let mut saw_overlay_alpha = false;

        for y in 0..base.height {
            for x in 0..base.width {
                let a = pixel_at(&base, x, y);
                let b = pixel_at(&paused, x, y);
                if x < third && a != b {
                    left_identical = false;
                }
                if x >= 2 * third {
                    if a != b {
                        differs_in_right_third = true;
                    }
                    let (_, _, _, alpha_b) = b;
                    let (_, _, _, alpha_a) = a;
                    if alpha_a == 0 && (100..=160).contains(&alpha_b) {
                        saw_overlay_alpha = true;
                    }
                }
            }
        }

        assert!(left_identical, "left third of the image must be unchanged by the overlay");
        assert!(differs_in_right_third, "pause overlay must change pixels in the right third");
        assert!(
            saw_overlay_alpha,
            "expected ~50%% overlay alpha (100..=160) at positions the base render left transparent"
        );
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
