INSERT INTO users (id, username, pass_hash, role, created_at)
SELECT '353b9ada0f0cfb157f9ad697', 'cubk', 'pbkdf2$100000$D3pJ/6z1jhjfbTcWQIcD5g==$xH4LJY4SExuos0/cyhelfE9VTacn+k9hQmu8Od3qBHo=', 'admin', datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'cubk');
