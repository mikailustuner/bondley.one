# Bondley: Institutional Security & Compliance Report (v2.0)

This report provides a granular audit of the security architecture, cryptographic standards, and data governance protocols implemented within the Bondley ecosystem.

## 1. Governance & Identity Protection
Bondley employs an "Audit-by-Design" approach to identity management, ensuring that session integrity is maintained at every layer of the stack.

### Authentication Lifecycle
- **Stateless Bearer Tokens**: Utilizing JWT (JSON Web Tokens) with standard **HS256** signatures.
- **Strict Lifetimes**: Access Tokens are configured for short-term expiration (typically 15-30 minutes), limiting the window of opportunity for stolen session tokens.
- **Refresh Token Rotation**: Unlike standard implementations, Bondley implements **Refres-Token-Rotation**. When a new access token is requested, a new refresh token is also issued, and the previous one is immediately invalidated in the database (`refresh_tokens.revoked_at`).
- **Cryptographic Hashing**: Refresh tokens are never stored in plain text. They are hashed using **SHA256** before being committed to the PostgreSQL persistence layer.

### Secure Transport & Edge Protection
- **HSTS Enforcement**: The system enforces HTTP Strict Transport Security (HSTS) with a duration of 1 year, preventing protocol downgrade attacks.
- **Proxy Chain Isolation**: A multi-tiered proxy system (Apache2 -> Nginx) ensures that the application server is never directly exposed to the internet. SSL termination occurs at the Apache2 layer using **TLS 1.3** and strong cipher suites (ECDHE-RSA-AES256-GCM-SHA384).

## 2. Cryptographic Audit
The Bondley engineering team has standardized on industry-leading cryptographic libraries to ensure long-term resistance to computational attacks.

| Category | Standard | Implementation Detail |
| :--- | :--- | :--- |
| **Password Hashing** | Bcrypt | Utilizing `gensalt()` with adaptive cost factors (Default: 12). |
| **MFA Secret Encryption**| Fernet (AES-128-CBC) | Utilizing the `cryptography` library. Secrets are encrypted at rest. |
| **Token Integrity** | SHA256 / HMAC | Used for refresh token hashing and JWT signatures. |
| **Transport Security** | TLS 1.3 | Enforced for all internal and external communication. |

## 3. Multi-Factor Authentication (MFA) Lifecycle
Bondley provides enterprise-grade 2FA to PROTECT institutional and retail assets.

- **TOTP (RFC 6238)**: Implemented via the `pyotp` library, ensuring compatibility with Google Authenticator, Authy, and hardware tokens.
- **Double-Layer Protection**: TOTP secrets are encrypted with a system-level `MFA_ENCRYPTION_KEY` before storage, ensuring that even a full database leak cannot compromise 2FA stability without the environment key.
- **Backup Strategy**: Users are provided with 8 secure backup codes upon setup. Each code is **SHA256-hashed**; once used, it is permanently deleted from the system.

## 4. Privacy Compliance & Data Governance
Bondley is designed to meet the requirements of **KVKK (Turkey)** and **GDPR (EU)**.

### Data Mapping Summary
| Principle | Implementation in Bondley |
| :--- | :--- |
| **Purpose Limitation** | Data collected (ISINs, Preferences) is used solely for yield analysis. |
| **Data Minimization** | We do not collect unnecessary PII; only essential email and auth data. |
| **Right to Erasure**| Database schema supports `CASCADE` deletes for users and their metrics. |
| **Security of Processing** | Mandatory SSL/TLS, Encrypted secrets, and Regular Audit Logs. |

**Audit Logs**: The `audit_logs` table captures critical administrative actions (Sync triggers, user privilege escalations) with UTC timestamps and IP source tracking.

## 5. Infrastructure Hardening
- **Firewall Isolation**: Only ports 80 (HTTP) and 443 (HTTPS) are exposed on the host. Internal service communication (Postgres/Redis) is isolated within an internal Docker network.
- **Log Management**: Automated log rotation (`max-size: 10m`) ensures that logs do not facilitate DoS (Disk Exhaustion) attacks while preserving at least 3 generations of audit trails.
- **Rate Limiting**: Implemented at the API gateway level to prevent brute-force attacks on auth and calculation endpoints.

## 6. Strategic Incident Response Plan
In the event of a security anomaly, Bondley engineering follows a standard 4-step framework:

1.  **Identification**: Monitoring layer (Nginx logs/System errors) detects anomalous traffic patterns or database integrity shifts.
2.  **Containment**: Immediate revocation of all user tokens via `revoke_all_user_tokens` and temporary service suspension if a zero-day is suspected.
3.  **Eradication**: Patching the vulnerability and rotating system-level encryption keys (`JWT_SECRET`, `MFA_ENCRYPTION_KEY`).
4.  **Recovery**: Restoring services from encrypted backups and notifying affected data subjects in accordance with KVKK/GDPR timelines.
