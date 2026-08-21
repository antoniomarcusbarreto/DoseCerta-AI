# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Brazilian adults (Portuguese/PT-BR only) undergoing GLP-1 weight-loss treatment (semaglutide, tirzepatide, liraglutide) who self-track injections/doses, weight, and side effects. The primary user base may skew toward older adults, so accessibility is a first-class concern, not an afterthought. Secondary user: internal admins/support staff via the `/painel/*` panel (Firebase custom claim `admin`) who manage accounts, subscriptions, and broadcasts.

## Product Purpose

Organize and record a GLP-1 treatment journey: dose titration schedule, injection-site rotation, pen stock/expiry, weight/measures, hydration, nutrition, side effects, bowel/gut symptoms, and progress photos — plus an AI "co-pilot" chat that reasons over that full history. The product is explicitly not a prescribing or diagnostic tool; it organizes and records, it does not prescribe.

## Positioning

The differentiator is twofold, held in roughly equal weight:

1. GLP-1-specific domain structure — dose titration steps, pen inventory/expiry, injection-site rotation — that a generic medication reminder app or spreadsheet doesn't model.
2. An AI co-pilot with context across the user's full logged history (doses, weight, symptoms, meals), not a stateless chatbot.

Tagline: "Seu co-piloto de hábitos e tratamento com GLP-1."

## Operating Context

- Locale is exclusively Brazil/PT-BR: all UI copy, dates as DD/MM/YYYY, decimals with a comma (e.g. "105,5 kg"), timezone America/Sao_Paulo. This is non-negotiable across the whole product, not just top-level screens.
- Mobile-first PWA: must respect iOS safe areas (notch, bottom home indicator). There is no reliable browser back button to depend on, so navigation must be self-contained — a fixed bottom tab bar (Início, Histórico, Evolução, Ajustes) is the primary navigation model, not hidden/overflow menus.
- Firestore data is strictly per-user (`users/{uid}/...`), with no cross-user sharing. Protocol changes archive (`ativo: false`) rather than delete, preserving historical linkage between titration steps and weight/side-effect logs.

## Capabilities and Constraints

- Auth: Firebase Auth via email/password and WebAuthn passkeys.
- Push notifications via FCM power reminders.
- Admin capabilities (Cloud Functions): list/block user accounts, grant free trials, view metrics, send broadcast notifications.
- Monetization: paid subscription model, **pre-launch** — not yet live to real paying users. Future work should not assume production traffic or an existing user base.
- Hard constraint: not a certified medical device. UI copy must avoid prescriptive medical language and keep a supportive, informative tone rather than a clinical/authoritative one.

## Brand Commitments

Name: "DoseCerta" (also rendered "Dose Certa"). Theme color `#3B4C5E`, background `#EEF2F4`. Icons live under `public/icons/`. Manifest categories: health, medical, lifestyle.

## Evidence on Hand

`README.md` documents the product description and architecture ("Estrutura" section), including a deliberate WCAG AA contrast fix already applied to `--ink-muted`/`--on-hero-muted` tokens. No testimonials, case studies, or press exist — future work must not fabricate them.

## Product Principles

- GLP-1-specific tracking structure and AI co-pilot context are equally core to the pitch; neither should be treated as secondary.
- Brazilian locale conventions (date, number, timezone formats) are non-negotiable everywhere in the product.
- Never read as a medical device: stay informative and supportive, never prescriptive or clinical in tone.
- Design for an older-skewing user base: legible, high-contrast, with no hidden or buried navigation.
- PWA navigation must be self-sufficient — never rely on the browser's back button.

## Accessibility & Inclusion

Primary user base may include older adults. High contrast, large and legible typography, and clear visual hierarchy are essential; avoid hidden menus or interactions that depend on discovery. WCAG AA contrast is already enforced in current design tokens (see README).
