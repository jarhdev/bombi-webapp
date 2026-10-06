# n8n

- `backup/`: copia JSON de los workflows actuales del bot, **sin modificar**. Exportar desde n8n (menú del workflow → Download) antes de tocar nada.
- `workflows/`: workflows nuevos de la webapp (se crean en la Fase 3). Cada uno se importa en n8n con "Import from File".

Los workflows del bot no se modifican, ni se agrega otro Telegram Trigger para el mismo bot.
