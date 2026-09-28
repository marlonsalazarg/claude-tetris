---
name: clima
description: Obtiene el clima actual y el pronóstico de Lima, Perú. Úsala cuando el usuario pregunte por el clima, la temperatura, si va a llover, o invoque /clima.
allowed-tools: Bash(curl:*)
---

# Clima en Lima, Perú

Consulta el clima de **Lima, Perú** usando [wttr.in](https://wttr.in) (gratis, sin API key). La ubicación es fija: ignora cualquier otra ciudad o la ubicación por IP.

## Pasos

1. Clima actual (una línea):

   ```bash
   curl -s --max-time 10 "https://wttr.in/Lima,Peru?format=%c+%t+(sensación+%f),+humedad+%h,+viento+%w,+lluvia+%p&lang=es"
   ```

2. Pronóstico de hoy y los próximos 2 días (solo si el usuario lo pide o pregunta por lluvia/mañana):

   ```bash
   curl -s --max-time 10 "https://wttr.in/Lima,Peru?format=j1&lang=es"
   ```

   Del JSON usa `weather[].date`, `maxtempC`, `mintempC` y, en `hourly[]`, `chanceofrain` y `lang_es[0].value` (descripción).

3. Responde en español, breve:
   - Condición y temperatura actual en Lima (con sensación térmica)
   - Humedad y viento
   - Si aplica: máx/mín y probabilidad de lluvia por día

## Errores

- Si `curl` falla o hay timeout, informa que el servicio no respondió y sugiere reintentar.
- Si el usuario pide el clima de otra ciudad, indica que esta skill solo cubre Lima, Perú.
