use rand::Rng;

/// Generate a random investigation code (8 characters, alphanumeric uppercase)
pub fn generate_investigation_code() -> String {
    const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let mut rng = rand::thread_rng();
    
    (0..8)
        .map(|_| {
            let idx = rng.gen_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_code_length() {
        let code = generate_investigation_code();
        assert_eq!(code.len(), 8);
    }

    #[test]
    fn test_generate_code_format() {
        let code = generate_investigation_code();
        assert!(code.chars().all(|c| c.is_ascii_alphanumeric() && c.is_ascii_uppercase()));
    }
}
