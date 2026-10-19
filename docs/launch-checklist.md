# Keymivo — checklist para operar al 100% con realtors

Estado al 19 de octubre de 2026. ✅ = hecho · 👤 = lo haces tú · 🤖 = lo hago yo · 🤝 = juntos.

## Ya funciona
✅ App web completa (clientes, tours, showing mode offline, IA, comparación, ofertas, reportes PDF, portal del comprador, equipos, admin)
✅ Página principal keymivo.com · app.keymivo.com · correos desde keymivo.com (Resend)
✅ Gmail / Google Calendar / Maps / Follow Up Boss (código) · Stripe en modo prueba
✅ App Android en Play Console (prueba interna publicada)

## Fase 1 — La empresa (bloquea cobrar, Play como empresa y iPhone)
1. 👤 Decidir LLC o C-Corp. Si buscarás inversionistas: **C-Corp de Delaware vía Stripe Atlas** (incluye EIN, agente y 83(b)).
2. 👤 Formar la empresa en Delaware.
3. 👤 Registrarla en Massachusetts como empresa foránea (con el Certificate of Good Standing de Delaware).
4. 👤 Abrir cuenta de banco del negocio.
5. 👤 Pedir el D-U-N-S (developer.apple.com/enroll/duns-lookup).

## Fase 2 — Seguridad e infraestructura (antes del primer cliente real)
6. 👤 Revocar la key vieja de Resend y el token de GitHub que salieron en una captura.
7. 👤 Contratar **Supabase Pro** ($25/mes): respaldos diarios, sin pausas, 100 GB para fotos y grabaciones.
8. 👤 Poner un **límite de gasto en OpenAI** (platform.openai.com → Limits).
9. 👤 Crear los alias **support@, hello@, privacy@, reviewer@** en Google Workspace.
10. 👤 Desbloquear keymivo.com en tu red (Xfinity → Advanced Security) o activar DNS seguro en Chrome.
11. 🤖 Monitoreo de errores (Sentry) y alerta si la app se cae.

## Fase 3 — Cobrar de verdad
12. 👤 Activar la cuenta de Stripe en modo real con los datos de la empresa, EIN y banco.
13. 🤖 Crear en modo real los productos Pro ($99) y Team ($399), el webhook y el portal de facturación; 👤 pegar las keys reales en Supabase.
14. 🤝 Hacer un pago real pequeño y reembolsarlo para comprobar todo el ciclo.

## Fase 4 — Legal
15. 👤 Revisión de Terms y Privacy por un abogado (grabaciones con consentimiento de todas las partes en MA, fair housing, datos).
16. 🤖 Poner el nombre legal de la empresa en los documentos y quitar el aviso "Draft".

## Fase 5 — Google para todos los realtors
17. 👤 Grabar el video demo y enviar la verificación de Google (guía: docs/google-oauth-verification.md). Tarda 2–6 semanas; mientras tanto hasta 100 usuarios con aviso de "app no verificada".

## Fase 6 — Google Play
18. 👤 Darme el correo de Google de tu Android → 🤖 te agrego como tester.
19. 👤 Crear la cuenta demo para revisores (reviewer@keymivo.com con datos demo).
20. 🤖 Capturas de pantalla, ficha de la tienda y formularios (privacidad, clasificación, público, acceso).
21. 👤 Con el D-U-N-S: cambiar la cuenta a **Organización** (evita la prueba de 12 testers × 14 días).
22. 🤝 Enviar a producción.

## Fase 7 — Prueba real y lanzamiento
23. 👤 Probar un showing real en tu teléfono: grabación, fotos, modo sin señal.
24. 🤖 Revisión completa como realtor nuevo (registro → onboarding → cliente → tour → showing → análisis → oferta → reporte → portal) y corregir lo que falle.
25. 👤 Probar Follow Up Boss con una key real.
26. 🤝 Beta con 3–5 realtors conocidos; ajustar con su feedback.
27. 🤝 Lanzamiento.

## Después del lanzamiento (opcional)
- App de iPhone en la App Store (Apple Developer $99/año + D-U-N-S). Hoy ya se puede instalar desde Safari → "Agregar a pantalla de inicio".
- DocuSign para contratos de representación del comprador.
- Dashboards para brokerages, más CRMs (HubSpot, GoHighLevel), datos de MLS.
