//! Pure, unit-testable pieces of the update check (UPD-01..UPD-04).
//!
//! Nothing here performs I/O. The single HTTPS request required by UPD-02
//! lives in `check_for_updates` (`lib.rs`); this module only parses the
//! response it gets back and compares versions, so both can be tested
//! without a network call.

/// Extracts the release tag from a GitHub "releases/latest" redirect's
/// `Location` header, e.g. `https://github.com/okms/clickclock/releases/tag/v0.2.1`
/// -> `Some("0.2.1")`. Returns `None` if the last path segment isn't a
/// parseable semver version (with an optional leading `v`).
pub fn latest_from_location(location: &str) -> Option<String> {
    let trimmed = location.trim_end_matches('/');
    let last = trimmed.rsplit('/').next()?;
    if last.is_empty() {
        return None;
    }
    let version = last.strip_prefix('v').unwrap_or(last);
    semver::Version::parse(version).ok()?;
    Some(version.to_string())
}

/// UPD-03: is `latest` newer than `current`? Both must be parseable semver
/// versions; an unparsable version is an error, not "not newer".
pub fn is_newer(current: &str, latest: &str) -> Result<bool, String> {
    let current = semver::Version::parse(current).map_err(|err| err.to_string())?;
    let latest = semver::Version::parse(latest).map_err(|err| err.to_string())?;
    Ok(latest > current)
}

/// UPD-02: the single HTTPS request the update check makes. GETs `url`
/// (the project's public "releases/latest" page) with redirects disabled,
/// and expects a 302 whose `Location` header names the latest release tag.
/// No user data is sent beyond what any HTTP request carries.
pub async fn fetch_latest_tag(client: &reqwest::Client, url: &str) -> Result<String, String> {
    let response = client
        .get(url)
        .send()
        .await
        .map_err(|err| format!("could not reach {url}: {err}"))?;

    if !response.status().is_redirection() {
        return Err(format!(
            "expected a redirect from {url}, got status {}",
            response.status()
        ));
    }

    let location = response
        .headers()
        .get(reqwest::header::LOCATION)
        .ok_or_else(|| "redirect response had no Location header".to_string())?
        .to_str()
        .map_err(|err| format!("Location header was not valid text: {err}"))?
        .to_string();

    latest_from_location(&location)
        .ok_or_else(|| format!("could not find a version in redirect target: {location}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn upd_02_latest_from_location_extracts_version() {
        assert_eq!(
            latest_from_location("https://github.com/okms/clickclock/releases/tag/v0.2.1"),
            Some("0.2.1".to_string())
        );
    }

    #[test]
    fn upd_02_latest_from_location_tolerates_trailing_slash() {
        assert_eq!(
            latest_from_location("https://github.com/okms/clickclock/releases/tag/v0.2.1/"),
            Some("0.2.1".to_string())
        );
    }

    #[test]
    fn upd_02_latest_from_location_rejects_garbage() {
        assert_eq!(latest_from_location("not a url"), None);
        assert_eq!(latest_from_location(""), None);
        assert_eq!(
            latest_from_location("https://github.com/okms/clickclock/releases"),
            None
        );
    }

    #[test]
    fn upd_03_is_newer_true_when_greater() {
        assert_eq!(is_newer("0.2.1", "0.3.0"), Ok(true));
    }

    #[test]
    fn upd_03_is_newer_false_when_equal() {
        assert_eq!(is_newer("0.3.0", "0.3.0"), Ok(false));
    }

    #[test]
    fn upd_03_is_newer_false_when_current_is_greater() {
        assert_eq!(is_newer("1.0.0", "0.9.9"), Ok(false));
    }

    #[test]
    fn upd_03_is_newer_err_on_unparsable_version() {
        assert!(is_newer("x", "0.1.0").is_err());
    }

    /// UPD-02 live check: confirms the real GitHub redirect still has the
    /// shape `fetch_latest_tag` expects. Not run by default (needs
    /// network); run explicitly with `cargo test -- --ignored`. Uses
    /// `tauri::async_runtime::block_on` (tauri is already a dependency of
    /// this crate) instead of pulling in a test-runtime crate of our own.
    #[test]
    #[ignore]
    fn upd_02_fetch_latest_tag_hits_real_github() {
        let client = reqwest::Client::builder()
            .redirect(reqwest::redirect::Policy::none())
            .timeout(std::time::Duration::from_secs(10))
            .user_agent("ClickClock/test")
            .build()
            .expect("client builds");

        let tag = tauri::async_runtime::block_on(fetch_latest_tag(
            &client,
            "https://github.com/okms/clickclock/releases/latest",
        ))
        .expect("live request should succeed");

        println!("fetch_latest_tag returned: {tag}");
        // Sanity check: it should at least parse as semver.
        assert!(semver::Version::parse(&tag).is_ok());
    }
}
