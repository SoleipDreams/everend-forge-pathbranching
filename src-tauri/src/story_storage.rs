//! Recoverable authoring writes. A durable journal precedes every replacement;
//! incomplete batches roll back before a universe can be read again.
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard};
use std::time::{SystemTime, UNIX_EPOCH};

static WRITER: Mutex<()> = Mutex::new(());
const TRANSACTIONS: &str = ".everend/.pathbranching/.transactions";

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BatchFile {
    pub relative_path: String,
    pub content: String,
    pub expected_exists: bool,
    pub expected_content: Option<String>,
    pub expected_modified_ms: Option<u128>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedFile {
    pub relative_path: String,
    pub modified_ms: Option<u128>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchResult {
    pub ok: bool,
    pub path: String,
    pub message: Option<String>,
    pub files: Vec<SavedFile>,
}

#[derive(Serialize, Deserialize)]
struct JournalEntry {
    relative_path: String,
    original: Option<String>,
    #[serde(default)]
    original_modified_ms: Option<u128>,
    replacement: String,
}

#[derive(Serialize, Deserialize)]
struct Journal {
    version: u8,
    committed: bool,
    entries: Vec<JournalEntry>,
}

pub fn lock() -> Result<MutexGuard<'static, ()>, String> {
    WRITER
        .lock()
        .map_err(|_| "Authoring storage lock is unavailable.".to_string())
}

/// The OS releases this lock even if the app crashes. Standalone and Suite
/// therefore cannot observe each other's half-written batch on Windows.
pub fn lock_universe(root: &Path) -> Result<File, String> {
    let transactions = safe_path(root, TRANSACTIONS)?;
    fs::create_dir_all(&transactions).map_err(|error| error.to_string())?;
    let mut options = OpenOptions::new();
    options.read(true).write(true).create(true).truncate(false);
    #[cfg(windows)]
    {
        use std::os::windows::fs::OpenOptionsExt;
        options.share_mode(0);
    }
    let file = options
        .open(transactions.join("writer.lock"))
        .map_err(|error| format!("Universe is busy in another authoring process: {error}"))?;
    #[cfg(unix)]
    {
        use std::os::fd::AsRawFd;
        extern "C" {
            fn flock(fd: i32, operation: i32) -> i32;
        }
        if unsafe { flock(file.as_raw_fd(), 2 | 4) } != 0 {
            return Err(format!(
                "Universe is busy in another authoring process: {}",
                std::io::Error::last_os_error()
            ));
        }
    }
    Ok(file)
}

pub fn modified_ms(path: &Path) -> Option<u128> {
    fs::metadata(path)
        .ok()?
        .modified()
        .ok()?
        .duration_since(UNIX_EPOCH)
        .ok()
        .map(|time| time.as_millis())
}

fn safe_path(root: &Path, relative: &str) -> Result<PathBuf, String> {
    if relative.is_empty()
        || relative.starts_with('/')
        || relative.contains(['\\', ':', '\0'])
        || relative
            .split('/')
            .any(|part| part.is_empty() || part == "." || part == "..")
    {
        return Err(format!("Unsafe authoring file path: {relative}"));
    }
    let canonical_root = root.canonicalize().map_err(|error| error.to_string())?;
    let target = canonical_root.join(relative);
    let mut ancestor = target.as_path();
    while !ancestor.exists() {
        ancestor = ancestor
            .parent()
            .ok_or_else(|| "Invalid authoring target.".to_string())?;
    }
    if !ancestor
        .canonicalize()
        .map_err(|error| error.to_string())?
        .starts_with(&canonical_root)
    {
        return Err(format!("Authoring path escapes the universe: {relative}"));
    }
    Ok(target)
}

fn read_optional(path: &Path) -> Result<Option<String>, String> {
    match fs::read_to_string(path) {
        Ok(content) => Ok(Some(content)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!("Could not read {}: {error}", path.display())),
    }
}

fn replace_file(source: &Path, destination: &Path) -> Result<(), String> {
    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStrExt;
        #[link(name = "kernel32")]
        extern "system" {
            fn MoveFileExW(existing: *const u16, new: *const u16, flags: u32) -> i32;
        }
        let source: Vec<u16> = source.as_os_str().encode_wide().chain(Some(0)).collect();
        let destination: Vec<u16> = destination
            .as_os_str()
            .encode_wide()
            .chain(Some(0))
            .collect();
        // REPLACE_EXISTING | WRITE_THROUGH, same-volume atomic replacement.
        if unsafe { MoveFileExW(source.as_ptr(), destination.as_ptr(), 0x1 | 0x8) } == 0 {
            return Err(std::io::Error::last_os_error().to_string());
        }
        Ok(())
    }
    #[cfg(not(windows))]
    {
        fs::rename(source, destination).map_err(|error| error.to_string())
    }
}

fn write_synced(path: &Path, content: &str) -> Result<(), String> {
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(|error| error.to_string())?;
    file.write_all(content.as_bytes())
        .and_then(|_| file.sync_all())
        .map_err(|error| error.to_string())
}

pub fn write_atomic(path: &Path, content: &str) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "File needs a parent directory.".to_string())?;
    fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    let temp = parent.join(format!(
        ".pb-write-{}-{}.tmp",
        std::process::id(),
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|error| error.to_string())?
            .as_nanos()
    ));
    write_synced(&temp, content)?;
    let result = replace_file(&temp, path);
    if result.is_err() {
        let _ = fs::remove_file(temp);
    }
    result
}

fn write_journal(directory: &Path, journal: &Journal) -> Result<(), String> {
    write_atomic(
        &directory.join("journal.json"),
        &serde_json::to_string(journal).map_err(|error| error.to_string())?,
    )
}

fn rollback(root: &Path, journal: &Journal) -> Result<(), String> {
    let mut conflicts = Vec::new();
    for entry in journal.entries.iter().rev() {
        let path = safe_path(root, &entry.relative_path)?;
        let current = read_optional(&path)?;
        if current == entry.original {
            continue;
        }
        if current.as_deref() != Some(entry.replacement.as_str()) {
            conflicts.push(entry.relative_path.clone());
            continue;
        }
        match &entry.original {
            Some(original) => {
                write_atomic(&path, original)?;
                if let Some(milliseconds) = entry.original_modified_ms {
                    let duration = std::time::Duration::from_millis(
                        u64::try_from(milliseconds).map_err(|error| error.to_string())?,
                    );
                    let file = OpenOptions::new()
                        .write(true)
                        .open(&path)
                        .map_err(|error| error.to_string())?;
                    file.set_times(std::fs::FileTimes::new().set_modified(UNIX_EPOCH + duration))
                        .map_err(|error| error.to_string())?;
                }
            }
            None => fs::remove_file(path).map_err(|error| error.to_string())?,
        }
    }
    if conflicts.is_empty() {
        Ok(())
    } else {
        Err(format!("An interrupted save also contains external edits. They were preserved. Repair using the retained journal before reopening: {}", conflicts.join(", ")))
    }
}

/// Caller holds both process and universe locks during recovery and reading.
pub fn recover_locked(root: &Path) -> Result<(), String> {
    let directory = safe_path(root, TRANSACTIONS)?;
    if !directory.exists() {
        return Ok(());
    }
    for item in fs::read_dir(directory).map_err(|error| error.to_string())? {
        let item = item.map_err(|error| error.to_string())?;
        if !item.path().is_dir() {
            continue;
        }
        let journal_path = item.path().join("journal.json");
        if !journal_path.exists() {
            // No durable journal means no replacements started.
            fs::remove_dir_all(item.path()).map_err(|error| error.to_string())?;
            continue;
        }
        let journal: Journal = serde_json::from_str(
            &fs::read_to_string(&journal_path).map_err(|error| error.to_string())?,
        )
        .map_err(|error| {
            format!(
                "Invalid authoring recovery journal {}: {error}",
                journal_path.display()
            )
        })?;
        if journal.version != 1 {
            return Err(
                "Unsupported authoring recovery journal; files were preserved.".to_string(),
            );
        }
        if !journal.committed {
            rollback(root, &journal)?;
        }
        fs::remove_dir_all(item.path()).map_err(|error| error.to_string())?;
    }
    Ok(())
}

pub fn save_batch(root: &Path, files: Vec<BatchFile>) -> Result<BatchResult, String> {
    let _guard = lock()?;
    let _universe_guard = lock_universe(root)?;
    recover_locked(root)?;
    save_batch_locked(root, files, None)
}

fn save_batch_locked(
    root: &Path,
    files: Vec<BatchFile>,
    interrupt_after: Option<usize>,
) -> Result<BatchResult, String> {
    let mut paths = HashSet::new();
    let mut entries = Vec::new();
    for file in &files {
        if !file.relative_path.starts_with(".everend/.pathbranching/")
            || file.relative_path.starts_with(&format!("{TRANSACTIONS}/"))
        {
            return Err("Story batches only write PathBranching-owned files.".to_string());
        }
        let path_key = if cfg!(windows) {
            file.relative_path.to_lowercase()
        } else {
            file.relative_path.clone()
        };
        if !paths.insert(path_key) {
            return Err("Duplicate file in authoring batch.".to_string());
        }
        let path = safe_path(root, &file.relative_path)?;
        let original = read_optional(&path)?;
        if original.is_some() != file.expected_exists
            || (file.expected_exists
                && (file.expected_content != original
                    || (file.expected_modified_ms.is_some()
                        && modified_ms(&path) != file.expected_modified_ms)))
        {
            return Ok(BatchResult {
                ok: false,
                path: file.relative_path.clone(),
                message: Some(
                    "Universe file changed on disk. Reopen before overwriting.".to_string(),
                ),
                files: vec![],
            });
        }
        entries.push(JournalEntry {
            relative_path: file.relative_path.clone(),
            original,
            original_modified_ms: modified_ms(&path),
            replacement: file.content.clone(),
        });
    }
    let directory = safe_path(root, TRANSACTIONS)?.join(format!(
        "{}-{}",
        std::process::id(),
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|error| error.to_string())?
            .as_nanos()
    ));
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    let mut journal = Journal {
        version: 1,
        committed: false,
        entries,
    };
    for (index, entry) in journal.entries.iter().enumerate() {
        write_synced(&directory.join(format!("{index}.new")), &entry.replacement)?;
    }
    write_journal(&directory, &journal)?;
    let outcome = (|| {
        for (index, entry) in journal.entries.iter().enumerate() {
            if interrupt_after == Some(index) {
                return Err("Simulated interrupted authoring write.".to_string());
            }
            let path = safe_path(root, &entry.relative_path)?;
            // Check again immediately before replacement. Never overwrite a file
            // modified while the journal was prepared.
            if read_optional(&path)? != entry.original
                || (files[index].expected_modified_ms.is_some()
                    && modified_ms(&path) != files[index].expected_modified_ms)
            {
                return Err(format!(
                    "Universe file changed during saving: {}",
                    entry.relative_path
                ));
            }
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent).map_err(|error| error.to_string())?;
            }
            replace_file(&directory.join(format!("{index}.new")), &path)?;
        }
        Ok::<(), String>(())
    })();
    if let Err(error) = outcome {
        // Test interruptions deliberately leave the durable journal, simulating
        // a process death. Actual write failures roll back immediately.
        if interrupt_after.is_none() {
            rollback(root, &journal)?;
            fs::remove_dir_all(&directory).map_err(|error| error.to_string())?;
        }
        return Err(error);
    }
    journal.committed = true;
    if let Err(error) = write_journal(&directory, &journal) {
        journal.committed = false;
        rollback(root, &journal)?;
        return Err(error);
    }
    let saved = files
        .iter()
        .map(|file| SavedFile {
            relative_path: file.relative_path.clone(),
            modified_ms: safe_path(root, &file.relative_path)
                .ok()
                .and_then(|path| modified_ms(&path)),
        })
        .collect();
    // Committed journal cleanup may be retried on the next read.
    let _ = fs::remove_dir_all(directory);
    Ok(BatchResult {
        ok: true,
        path: root.to_string_lossy().to_string(),
        message: None,
        files: saved,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    struct Universe(PathBuf);
    impl Universe {
        fn new() -> Self {
            let path = std::env::temp_dir().join(format!(
                "pb-storage-{}-{}",
                std::process::id(),
                SystemTime::now()
                    .duration_since(UNIX_EPOCH)
                    .unwrap()
                    .as_nanos()
            ));
            fs::create_dir_all(&path).unwrap();
            Self(path)
        }
        fn write(&self, path: &str, content: &str) {
            let path = safe_path(&self.0, path).unwrap();
            fs::create_dir_all(path.parent().unwrap()).unwrap();
            fs::write(path, content).unwrap();
        }
        fn batch(&self, path: &str, content: &str) -> BatchFile {
            let target = safe_path(&self.0, path).unwrap();
            let old = read_optional(&target).unwrap();
            BatchFile {
                relative_path: path.into(),
                content: content.into(),
                expected_exists: old.is_some(),
                expected_content: old,
                expected_modified_ms: modified_ms(&target),
            }
        }
    }
    impl Drop for Universe {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }
    const STORY: &str = ".everend/.pathbranching/stories/main/story.json";
    const EVPATH: &str = ".everend/.pathbranching/stories/main/event.evpath";
    const NEW: &str = ".everend/.pathbranching/stories/main/new.json";

    #[test]
    fn authoring_batch_writes_all_files_and_removes_journal() {
        let root = Universe::new();
        root.write(STORY, "old");
        let files = vec![root.batch(STORY, "new"), root.batch(NEW, "created")];
        let result = save_batch(&root.0, files).unwrap();
        assert!(result.ok);
        assert_eq!(result.files.len(), 2);
        assert_eq!(fs::read_to_string(root.0.join(STORY)).unwrap(), "new");
        assert_eq!(fs::read_to_string(root.0.join(NEW)).unwrap(), "created");
        assert_eq!(
            fs::read_dir(root.0.join(TRANSACTIONS))
                .unwrap()
                .filter(|entry| entry.as_ref().unwrap().path().is_dir())
                .count(),
            0
        );
    }

    #[test]
    fn interrupted_batch_recovers_old_revision_and_removes_new_files() {
        let root = Universe::new();
        root.write(STORY, "old-story");
        root.write(EVPATH, "old-script");
        let files = vec![
            root.batch(STORY, "new-story"),
            root.batch(NEW, "created"),
            root.batch(EVPATH, "new-script"),
        ];
        let original_modified = files[0].expected_modified_ms;
        assert!(save_batch_locked(&root.0, files, Some(2)).is_err());
        assert_eq!(fs::read_to_string(root.0.join(STORY)).unwrap(), "new-story");
        recover_locked(&root.0).unwrap();
        assert_eq!(fs::read_to_string(root.0.join(STORY)).unwrap(), "old-story");
        assert_eq!(
            fs::read_to_string(root.0.join(EVPATH)).unwrap(),
            "old-script"
        );
        assert_eq!(
            modified_ms(&root.0.join(STORY)),
            original_modified,
            "rollback must preserve the save baseline for retry"
        );
        assert!(!root.0.join(NEW).exists());
        recover_locked(&root.0).unwrap();
    }

    #[test]
    fn external_evpath_edit_blocks_entire_batch_even_when_timestamp_is_unchanged() {
        let root = Universe::new();
        root.write(STORY, "old-story");
        root.write(EVPATH, "old-script");
        let mut files = vec![
            root.batch(STORY, "new-story"),
            root.batch(EVPATH, "new-script"),
        ];
        root.write(EVPATH, "external-script");
        files[1].expected_modified_ms = modified_ms(&root.0.join(EVPATH));
        let result = save_batch(&root.0, files).unwrap();
        assert!(!result.ok);
        assert_eq!(result.path, EVPATH);
        assert_eq!(fs::read_to_string(root.0.join(STORY)).unwrap(), "old-story");
        assert_eq!(
            fs::read_to_string(root.0.join(EVPATH)).unwrap(),
            "external-script"
        );
    }

    #[test]
    fn external_deletion_or_unexpected_creation_is_a_conflict() {
        let root = Universe::new();
        root.write(STORY, "old");
        let deletion = root.batch(STORY, "new");
        fs::remove_file(root.0.join(STORY)).unwrap();
        assert!(!save_batch(&root.0, vec![deletion]).unwrap().ok);
        let creation = root.batch(NEW, "new");
        root.write(NEW, "external");
        assert!(!save_batch(&root.0, vec![creation]).unwrap().ok);
        assert_eq!(fs::read_to_string(root.0.join(NEW)).unwrap(), "external");
    }

    #[test]
    fn recovery_never_overwrites_external_edits_after_a_crash() {
        let root = Universe::new();
        root.write(STORY, "old");
        root.write(EVPATH, "old-script");
        let files = vec![root.batch(STORY, "new"), root.batch(EVPATH, "new-script")];
        assert!(save_batch_locked(&root.0, files, Some(1)).is_err());
        root.write(STORY, "external-after-crash");
        let error = recover_locked(&root.0).unwrap_err();
        assert!(error.contains("external edits"));
        assert_eq!(
            fs::read_to_string(root.0.join(STORY)).unwrap(),
            "external-after-crash"
        );
        assert_eq!(
            fs::read_to_string(root.0.join(EVPATH)).unwrap(),
            "old-script"
        );
        assert!(fs::read_dir(root.0.join(TRANSACTIONS))
            .unwrap()
            .any(|entry| entry.unwrap().path().is_dir()));
    }

    #[cfg(windows)]
    #[test]
    fn a_real_write_failure_rolls_back_and_can_retry_the_same_baseline() {
        let root = Universe::new();
        root.write(STORY, "old-story");
        root.write(EVPATH, "old-script");
        let files = vec![
            root.batch(STORY, "new-story"),
            root.batch(EVPATH, "new-script"),
        ];
        let path = root.0.join(EVPATH);
        let mut permissions = fs::metadata(&path).unwrap().permissions();
        permissions.set_readonly(true);
        fs::set_permissions(&path, permissions).unwrap();
        assert!(save_batch(&root.0, files.clone()).is_err());
        assert_eq!(fs::read_to_string(root.0.join(STORY)).unwrap(), "old-story");
        assert_eq!(fs::read_to_string(&path).unwrap(), "old-script");
        let mut permissions = fs::metadata(&path).unwrap().permissions();
        permissions.set_readonly(false);
        fs::set_permissions(&path, permissions).unwrap();
        assert!(save_batch(&root.0, files).unwrap().ok);
    }

    #[test]
    fn universe_os_lock_blocks_concurrent_readers_and_writers() {
        let root = Universe::new();
        let first = lock_universe(&root.0).unwrap();
        assert!(lock_universe(&root.0).is_err());
        drop(first);
        assert!(lock_universe(&root.0).is_ok());
    }

    #[test]
    fn authoring_batch_rejects_unsafe_duplicate_and_non_owned_paths() {
        let root = Universe::new();
        let file = root.batch(NEW, "new");
        assert!(save_batch(&root.0, vec![file.clone(), file]).is_err());
        assert!(safe_path(&root.0, "../outside.json").is_err());
        let file = root.batch("Canon/original.md", "modified");
        assert!(save_batch(&root.0, vec![file]).is_err());
        assert!(!root.0.join(NEW).exists());
    }
}
