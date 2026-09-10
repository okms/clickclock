//! The document (`clickclock.json`) lives in the per-user app data
//! directory (PERS-03). Writing it must never leave a partially written file
//! on disk (PERS-04): every write goes to a sibling `.tmp` file first and is
//! then renamed into place, which is atomic on the same filesystem.

use std::fs;
use std::io;
use std::path::{Path, PathBuf};

/// The document's file name inside the app data directory.
pub const DOC_FILENAME: &str = "clickclock.json";

/// Read the document at `path`. Returns `Ok(None)` if the file does not
/// exist yet (first run).
pub fn read_doc_at(path: &Path) -> io::Result<Option<String>> {
    match fs::read_to_string(path) {
        Ok(contents) => Ok(Some(contents)),
        Err(err) if err.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(err) => Err(err),
    }
}

/// Atomically write `contents` to `path`: create the parent directory if
/// needed, write to `<path>.tmp`, then `rename` it over `path`. A reader can
/// never observe a partially written file (PERS-04).
pub fn atomic_write(path: &Path, contents: &str) -> io::Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    let tmp_path = tmp_path_for(path);
    fs::write(&tmp_path, contents)?;
    fs::rename(&tmp_path, path)?;
    Ok(())
}

fn tmp_path_for(path: &Path) -> PathBuf {
    let mut tmp = path.as_os_str().to_os_string();
    tmp.push(".tmp");
    PathBuf::from(tmp)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A fresh, empty directory under the system temp dir, unique to this
    /// test process and test name.
    fn scratch_dir(name: &str) -> PathBuf {
        let mut dir = std::env::temp_dir();
        dir.push(format!(
            "clickclock-doc-test-{}-{}",
            name,
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("create scratch dir");
        dir
    }

    #[test]
    fn pers_04_atomic_write_creates_file_with_exact_content_and_no_tmp_remains() {
        let dir = scratch_dir("basic");
        let path = dir.join(DOC_FILENAME);

        atomic_write(&path, "{\"today\":1}").expect("atomic_write");

        assert!(path.exists(), "final file should exist");
        assert_eq!(
            fs::read_to_string(&path).unwrap(),
            "{\"today\":1}",
            "final file should have exact content"
        );
        assert!(
            !tmp_path_for(&path).exists(),
            "no .tmp file should remain after a successful write"
        );

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn pers_04_atomic_write_overwrites_existing_file_with_new_content() {
        let dir = scratch_dir("overwrite");
        let path = dir.join(DOC_FILENAME);

        atomic_write(&path, "{\"today\":1}").expect("first write");
        atomic_write(&path, "{\"today\":2}").expect("second write");

        assert_eq!(
            fs::read_to_string(&path).unwrap(),
            "{\"today\":2}",
            "final file should have the newer content"
        );
        assert!(
            !tmp_path_for(&path).exists(),
            "no .tmp file should remain after the overwrite"
        );

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn atomic_write_creates_the_app_data_dir_if_missing() {
        let mut dir = std::env::temp_dir();
        dir.push(format!(
            "clickclock-doc-test-missing-dir-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&dir);
        let path = dir.join(DOC_FILENAME);

        atomic_write(&path, "hello").expect("atomic_write should create parent dir");
        assert_eq!(fs::read_to_string(&path).unwrap(), "hello");

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn pers_03_read_doc_at_returns_none_when_the_file_does_not_exist() {
        let dir = scratch_dir("missing");
        let path = dir.join(DOC_FILENAME);

        assert_eq!(read_doc_at(&path).unwrap(), None);

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn read_doc_at_returns_the_written_contents() {
        let dir = scratch_dir("present");
        let path = dir.join(DOC_FILENAME);
        atomic_write(&path, "hello world").expect("atomic_write");

        assert_eq!(read_doc_at(&path).unwrap(), Some("hello world".to_string()));

        let _ = fs::remove_dir_all(&dir);
    }
}
