use aws_config::BehaviorVersion;
use aws_types::region::Region;
use chrono::{DateTime, Utc};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tokio::fs;

#[derive(Serialize, Deserialize)]
struct AuthTokens {
    refresh_token: String,
    access_token: String,
    expires_at: DateTime<Utc>,
}

#[derive(Serialize, Deserialize)]
struct Credentials {
    access_key: String,
    secret_key: String,
    token: String,
    expiry_time: DateTime<Utc>,
}

pub struct QuiltAuth {
    registry_url: String,
    http_client: Client,
    auth_dir: PathBuf,
}

impl QuiltAuth {
    pub fn new(registry_url: String) -> Self {
        let auth_dir = dirs::data_dir()
            .unwrap_or_default()
            .join("Quilt");
        
        Self {
            registry_url,
            http_client: Client::new(),
            auth_dir,
        }
    }

    pub async fn login(&self) -> crate::Res<()> {
        // 1. Verify URL exists
        if self.registry_url.is_empty() {
            return Err(Error::MissingRegistryUrl);
        }

        // 2. Open browser to get refresh token
        let code_url = format!("{}/code", self.registry_url);
        if let Err(_) = webbrowser::open(&code_url) {
            println!("Please visit {} to get your authentication code", code_url);
        }

        // 3. Prompt for refresh token
        println!("Enter the code from the webpage:");
        let mut refresh_token = String::new();
        std::io::stdin().read_line(&mut refresh_token)?;
        let refresh_token = refresh_token.trim().to_string();

        // 4. Exchange refresh token for auth tokens
        let tokens = self.get_auth_tokens(&refresh_token).await?;
        
        // 5. Cache tokens
        self.save_tokens(&tokens).await?;
        
        // 6. Get initial credentials
        self.refresh_credentials(&tokens.access_token).await?;

        Ok(())
    }

    async fn get_auth_tokens(&self, refresh_token: &str) -> crate::Res<AuthTokens> {
        let response = self.http_client
            .post(format!("{}/api/token", self.registry_url))
            .form(&[("refresh_token", refresh_token)])
            .send()
            .await?;

        Ok(response.json().await?)
    }

    async fn save_tokens(&self, tokens: &AuthTokens) -> crate::Res<()> {
        fs::create_dir_all(&self.auth_dir).await?;
        let tokens_path = self.auth_dir.join("auth.json");
        fs::write(tokens_path, serde_json::to_string(tokens)?).await?;
        Ok(())
    }

    async fn refresh_credentials(&self, access_token: &str) -> crate::Res<Credentials> {
        let response = self.http_client
            .post(format!("{}/api/auth/get_credentials", self.registry_url))
            .bearer_auth(access_token)
            .send()
            .await?;

        let creds: Credentials = response.json().await?;
        
        // Save credentials
        let creds_path = self.auth_dir.join("credentials.json");
        fs::write(creds_path, serde_json::to_string(&creds)?).await?;
        
        Ok(creds)
    }
}
