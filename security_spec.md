# Security Specification: Floaki Winter Surfer Leaderboard

## Phase 0: Data Invariants
1. **Strict Ownership**: A player may only create, update, or delete `/leaderboard/{userId}` where `userId == request.auth.uid` and `request.auth.token.email_verified == true`.
2. **No PII Exposure**: Leaderboard documents never contain `email`, `phone`, or `address`.
3. **Immutable Identity & Creation Time**: `userId` and `createdAt` cannot be modified on update; `createdAt` and `updatedAt` must equal `request.time`.
4. **Monotonic Score Integrity**: Players may only update their score with an equal or higher valid integer (`0 <= score <= 10000000`) or rename their `playerName` without inflating `score`.
5. **Strict Key & Size Bounds**: Extra shadow fields are rejected (`hasOnly`); `playerName` is bounded to `1..24` characters matching `^[a-zA-Z0-9äöüÄÖÜß ._\\-]+$`.

## Dirty Dozen Adversarial Payloads (All Must Fail with PERMISSION_DENIED)
1. **Unauthenticated Write**: `create /leaderboard/uid1` with `request.auth == null`.
2. **Unverified Email Write**: `create /leaderboard/uid1` with `request.auth.token.email_verified == false`.
3. **Cross-User Impersonation (Path)**: `create /leaderboard/otherUid` while signed in as `uid1`.
4. **Cross-User Identity Spoofing (Body)**: `create /leaderboard/uid1` with `userId: "otherUid"`.
5. **Shadow Field Injection**: `create /leaderboard/uid1` with valid fields + `isAdmin: true`.
6. **Client Timestamp Forgery (Create)**: `create /leaderboard/uid1` with hardcoded `createdAt` != `request.time`.
7. **Immutable Field Tampering (Update)**: `update /leaderboard/uid1` modifying `createdAt` or `userId`.
8. **Score Downgrade / Negative Score**: `create /leaderboard/uid1` with `score: -50` or `update` reducing `score`.
9. **Type Poisoning**: `update /leaderboard/uid1` with `score: "999999"` (string instead of int).
10. **Oversized Display Name (Resource Poisoning)**: `create /leaderboard/uid1` with 1,500-char `playerName`.
11. **Invalid Path ID Injection**: `get /leaderboard/invalid$id!with*badchars`.
12. **Wildcard Unprotected Collection Write**: `create /users/uid1` or `create /scores/123` (caught by default-deny).
