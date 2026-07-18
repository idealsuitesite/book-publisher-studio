# shared-types

This package contains only transport contracts shared between applications. No business logic, no validation rules, no runtime behavior.

Interfaces, types, enums — nothing else. No mappers, no validators, no services, no business rules. If it does anything at runtime, it doesn't belong here (CTO direction, 2026-07-18 — see `docs/DECISIONS.md` ADR-0033).
