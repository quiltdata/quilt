impl Commands {
    pub async fn login(&self, registry_url: String) -> Res<()> {
        let auth = QuiltAuth::new(registry_url);
        auth.login().await
    }
}
