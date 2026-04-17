use std::path::PathBuf;
use std::time::SystemTime;

use ignore::WalkBuilder;
use serde::Serialize;

use crate::error::{AppError, AppResult};

const SKIP_DIRS: &[&str] = &[
    ".git",
    "node_modules",
    "dist",
    ".next",
    ".turbo",
    ".wrangler",
    ".vite",
    ".cache",
    "build",
    "out",
    "coverage",
    "target",
    ".idea",
    ".vscode",
    ".vercel",
    ".svelte-kit",
];

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "kind", rename_all = "lowercase")]
pub enum TreeNode {
    Folder {
        name: String,
        /// Path relative to the picked root, forward-slash normalized.
        path: String,
        /// Parent's relative path. Empty string = top level.
        parent: String,
        depth: u32,
        /// Absolute path on disk, useful for `convertFileSrc` from JS.
        abs: PathBuf,
    },
    File {
        name: String,
        path: String,
        parent: String,
        depth: u32,
        abs: PathBuf,
        size: u64,
        modified_ms: i64,
    },
}

/// Walk a folder recursively, returning every `.html` / `.htm` file plus the folders
/// containing them. Folders whose subtree contains no HTML files are pruned.
#[tauri::command]
pub async fn walk_html(root: PathBuf) -> AppResult<Vec<TreeNode>> {
    if !root.is_dir() {
        return Err(AppError::NotFound(root.display().to_string()));
    }
    let r = root.clone();
    tokio::task::spawn_blocking(move || walk_blocking(&r))
        .await
        .map_err(|e| AppError::Other(format!("join: {e}")))?
}

fn walk_blocking(root: &std::path::Path) -> AppResult<Vec<TreeNode>> {
    let mut out: Vec<TreeNode> = Vec::with_capacity(256);

    let walker = WalkBuilder::new(root)
        .hidden(false)
        .git_ignore(true)
        .git_global(false)
        .git_exclude(true)
        .ignore(false)
        .parents(false)
        .filter_entry(|e| {
            // Always allow the root.
            if e.depth() == 0 {
                return true;
            }
            let name = e.file_name().to_string_lossy();
            if let Some(ft) = e.file_type() {
                if ft.is_dir() {
                    if SKIP_DIRS.iter().any(|s| name == *s) {
                        return false;
                    }
                    if name.starts_with('.') {
                        return false;
                    }
                } else if name.starts_with('.') {
                    return false;
                }
            }
            true
        })
        .build();

    for dent in walker.flatten() {
        if dent.depth() == 0 {
            continue;
        }
        let ft = match dent.file_type() {
            Some(f) => f,
            None => continue,
        };
        let abs = dent.path().to_path_buf();
        let rel = abs
            .strip_prefix(root)
            .unwrap_or(&abs)
            .to_string_lossy()
            .replace('\\', "/");
        let parent = std::path::Path::new(&rel)
            .parent()
            .map(|p| p.to_string_lossy().replace('\\', "/"))
            .unwrap_or_default();
        let name = dent.file_name().to_string_lossy().to_string();
        let depth = dent.depth() as u32;

        if ft.is_dir() {
            out.push(TreeNode::Folder {
                name,
                path: rel,
                parent,
                depth,
                abs,
            });
        } else if is_html(&name) {
            let md = match dent.metadata() {
                Ok(m) => m,
                Err(_) => continue,
            };
            let modified_ms = md
                .modified()
                .ok()
                .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as i64)
                .unwrap_or(0);
            out.push(TreeNode::File {
                name,
                path: rel,
                parent,
                depth,
                abs,
                size: md.len(),
                modified_ms,
            });
        }
    }

    // Sort: folders before files within the same parent. Folders alpha. Files newest-first.
    out.sort_by(|a, b| {
        let (a_parent, a_name, a_kind, a_mod) = key_for(a);
        let (b_parent, b_name, b_kind, b_mod) = key_for(b);
        a_parent
            .cmp(b_parent)
            .then(a_kind.cmp(&b_kind))
            .then_with(|| match a_kind {
                0 => a_name.cmp(b_name),
                _ => b_mod.cmp(&a_mod),
            })
    });

    Ok(prune_empty_folders(out))
}

fn key_for(n: &TreeNode) -> (&String, &String, u8, i64) {
    match n {
        TreeNode::Folder { parent, name, .. } => (parent, name, 0, 0),
        TreeNode::File {
            parent,
            name,
            modified_ms,
            ..
        } => (parent, name, 1, *modified_ms),
    }
}

fn is_html(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    lower.ends_with(".html") || lower.ends_with(".htm")
}

/// Drop folder nodes whose subtree contains zero HTML files.
fn prune_empty_folders(nodes: Vec<TreeNode>) -> Vec<TreeNode> {
    use std::collections::HashSet;
    let mut keep: HashSet<String> = HashSet::new();
    for n in &nodes {
        if let TreeNode::File { parent, .. } = n {
            let mut cur = parent.clone();
            while !cur.is_empty() {
                keep.insert(cur.clone());
                if let Some(idx) = cur.rfind('/') {
                    cur.truncate(idx);
                } else {
                    cur.clear();
                }
            }
        }
    }
    nodes
        .into_iter()
        .filter(|n| match n {
            TreeNode::Folder { path, .. } => keep.contains(path),
            _ => true,
        })
        .collect()
}
