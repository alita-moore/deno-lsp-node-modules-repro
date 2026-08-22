import pathlib
p = pathlib.Path("deno/cli/lsp/resolver.rs")
s = p.read_text()

def swap(old, new, label):
    global s
    assert s.count(old) == 1, f"{label}: {s.count(old)} matches"
    s = s.replace(old, new)

swap("  configured_dep_resolutions: Arc<ConfiguredDepResolutions>,\n",
     "  configured_dep_resolutions: Arc<OnceLock<Arc<ConfiguredDepResolutions>>>,\n",
     "field")

swap("""    let configured_dep_resolutions = (|| {
      let npm_pkg_req_resolver = npm_pkg_req_resolver.as_ref()?;
      Some(Arc::new(ConfiguredDepResolutions::new(
        workspace_resolver.clone(),
        config_data.and_then(|d| d.maybe_pkg_json().map(|p| p.as_ref())),
        npm_pkg_req_resolver,
        &pkg_json_resolver,
      )))
    })()
    .unwrap_or_default();
""", "    let configured_dep_resolutions = Arc::new(OnceLock::new());\n", "eager build")

swap("""      .configured_dep_resolutions
      .dep_key_from_resolution(specifier, referrer)""",
     """      .configured_dep_resolutions()
      .dep_key_from_resolution(specifier, referrer)""", "use: dep_key")

swap("""        .configured_dep_resolutions
        .deps_by_resolution""",
     """        .configured_dep_resolutions()
        .deps_by_resolution""", "use: roots")

swap("""  pub fn resource_url_to_configured_dep_key(""",
     """  fn configured_dep_resolutions(&self) -> Arc<ConfiguredDepResolutions> {
    self
      .configured_dep_resolutions
      .get_or_init(|| {
        let Some(npm_pkg_req_resolver) = self.npm_pkg_req_resolver.as_ref()
        else {
          return Default::default();
        };
        Arc::new(ConfiguredDepResolutions::new(
          self.workspace_resolver.clone(),
          self
            .config_data
            .as_ref()
            .and_then(|d| d.maybe_pkg_json().map(|p| p.as_ref())),
          npm_pkg_req_resolver,
          &self.pkg_json_resolver,
        ))
      })
      .clone()
  }

  pub fn resource_url_to_configured_dep_key(""", "accessor")

if "use std::sync::OnceLock;" not in s:
    swap("use std::sync::Arc;\n", "use std::sync::Arc;\nuse std::sync::OnceLock;\n", "import")

p.write_text(s)
print("patch2 applied")
