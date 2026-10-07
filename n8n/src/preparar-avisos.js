// Un ítem por mensaje de Telegram a enviar (si no hay avisos, no sigue).
return ($input.first().json.avisos || []).map((a) => ({ json: a }));
