# CLAUDE.md

Lee `AGENTS.md` para la guía completa del proyecto (stack, comandos,
convenciones, flujo DDR y reglas de trabajo). Resumen de reglas duras:

- Commits **en español**, sin `Co-Authored-By` ni menciones de IA.
- Frontend en Docker = build estático: `docker compose build frontend &&
  docker compose up -d frontend` tras cada cambio.
- No correr el suite completo de tests contra la BD viva (borra usuarios demo);
  correr solo los módulos afectados.
- El flujo DDR aplica cuatro ojos: ver `docs/FLUJO_DDR.md`.
