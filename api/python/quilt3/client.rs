// Add to client.rs

async fn get_client_for_bucket_with_credentials(
    bucket: &str, 
    creds: &Credentials
) -> Res<aws_sdk_s3::Client> {
    let region = get_region_for_bucket(bucket).await?;
    
    let config = aws_config::defaults(BehaviorVersion::latest())
        .region(region.clone())
        .credentials_provider(aws_sdk_s3::Credentials::new(
            &creds.access_key,
            &creds.secret_key,
            Some(creds.token.clone()),
            Some(creds.expiry_time),
            "quilt-registry",
        ))
        .load()
        .await;

    Ok(aws_sdk_s3::Client::new(&config))
}
