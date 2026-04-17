# Security

## Reporting

If you find a vulnerability, please email **security@artifaq.io** (or open a private security
advisory on GitHub). Please do not file public issues for security reports.

We aim to acknowledge within 48h.

## Threat model (v1)

| Threat                                       | Mitigation                                                        |
| -------------------------------------------- | ----------------------------------------------------------------- |
| User HTML reads our app cookies / storage    | Artifacts served from a different registrable domain              |
| User HTML escapes its sandbox in our viewer  | `<iframe sandbox=…>` without `allow-same-origin` (different origin makes that flag safe to grant if needed) |
| MIME confusion (HTML served as JS, etc.)     | Strict `Content-Type` + `X-Content-Type-Options: nosniff`         |
| CSRF on `/publish`                           | CORS gate, capability URL, Turnstile                              |
| Bot upload flood                             | Turnstile + IP rate-limit + 5MB cap + 30-day TTL                  |
| Enumeration of slot IDs                      | 71-bit unguessable nanoid                                         |
| Phishing / brand impersonation on our domain | Domain clearly marked as user content; abuse reports → takedown   |

## Out of scope for v1

- DDoS protection beyond what Cloudflare provides by default.
- Account-level abuse (no accounts yet).
- Long-term content moderation tooling.
