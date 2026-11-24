# Moba Training

Web de clases online de pilates, yoga y entrenamiento funcional de **María Hernández Cuellar**.

- `index.html` — web pública: horario real, test, tarifas, videoteca, retos, sobre mí, regalo, guía gratis y preguntas frecuentes.
- `cuenta.html` — área de la alumna: registro, reservas, bonos y pagos, videoteca y perfil.
- `panel.html` — panel de María: resumen, agenda, alumnas, facturación, bajas y avisos, vídeos y tarifas.
- `legal.html` — aviso legal, privacidad, cookies y condiciones de reserva.

HTML, CSS y JavaScript sin compilación. Base de datos y cuentas en Supabase (proyecto `moba-training`, id `qvzkkrvruknxyrmktkmw`, región París). Publicada con GitHub Pages.

## Primeros pasos (una sola vez)

1. **María crea su cuenta** en `cuenta.html` con su móvil (682 01 29 56). La cuenta con ese número queda como profesora (administradora); todas las demás son alumnas. Conviene hacerlo cuanto antes.
2. Rellenar en `js/config.js` los datos fiscales (NIF y domicilio), y si se quiere, el IBAN, el email y el Instagram.
3. Desde el panel, en **Agenda**: crear las clases en grupo (con «Repetir cada semana») y abrir los huecos de entrenamiento personal.

## Cómo funciona

- **Sin email:** todo va por WhatsApp. Las alumnas entran con su **móvil y una contraseña** (por dentro, cada móvil usa un email interno `34XXXXXXXXX@alumnas.mobatraining.es` que nunca recibe correos). El email real es opcional en su perfil.
- **Contraseña olvidada:** la alumna escribe a María por WhatsApp; en la ficha de la alumna, «Nueva contraseña» genera una temporal y la envía por WhatsApp. La alumna puede cambiarla en «Mi perfil».

- **Clases en directo:** por videollamada de WhatsApp. Al reservar, la alumna ve que María la llamará a su número. En la agenda, «Ver» muestra los teléfonos de cada clase, con botón de WhatsApp y «Copiar teléfonos» para montar el grupo.
- **Grupos de máximo 6 personas** (lo controla la base de datos).
- **Nada gratis salvo la clase de prueba:** quien crea una cuenta sin pagar solo ve la **clase de prueba grabada** (en «Vídeos», marcar «Clase de prueba»). El horario se ve, pero no puede reservar, y la videoteca sale con candados. El bloqueo está en el servidor, no solo en la pantalla.
- **Activación por WhatsApp:** la alumna elige plan en «Activar mi cuenta» y se abre WhatsApp con el mensaje para María (nombre, móvil, plan y forma de pago). La petición aparece en el panel como «Solicitud de activación»; al recibir el pago, María pulsa «Confirmar pago» y se desbloquea lo comprado. Las cuentas que no han pedido nada salen en «Cuentas sin activar», con botón de WhatsApp y «Activar».
- **Pagos:** la alumna pide la activación y paga por Bizum o en mano. María pulsa «Confirmar pago» y el bono se activa ese día y recibe número de factura. Las ventas cobradas en mano se registran con «Registrar venta».
- **Cancelaciones:** hasta 8 h antes, la clase vuelve al bono.
- **Avisos de renovación:** en «Bajas y avisos» y en el resumen, «Avisar por WhatsApp» abre WhatsApp con un mensaje de motivación ya escrito para renovar. Queda anotado cuándo se avisó.
- **Eliminar cuenta:** en la ficha de la alumna, solo si pide borrar sus datos (borra también sus bonos y reservas). Para dejar de atenderla, «Dar de baja».
- **Posibles bajas:** alumnas sin clases en 21 días o con el bono terminado sin renovar.
- **Vídeos:** se suben a Vimeo, YouTube (oculto) o Google Drive y se pega el enlace en «Vídeos». Solo lo pueden abrir las alumnas con videoteca o Moba Completo (o todas si se marca «Gratis»).

## Base de datos

Las migraciones están en `supabase/migrations/`. Las alumnas solo escriben a través de funciones del servidor (`reservar`, `cancelar_reserva`, `solicitar_bono`, `actualizar_perfil`, `darme_de_baja`, `ver_video`); el panel usa los permisos de administradora. El enlace de los vídeos nunca se envía a quien no tiene acceso. La función `admin-alumnas` (en `supabase/functions/`) da contraseñas temporales y elimina cuentas, solo para la profesora.

La confirmación por email está desactivada en Supabase. Si algún día se quiere usar email (por ejemplo, Gmail por SMTP), las plantillas en español ya están en `supabase/templates/`.

## Pendiente

- Grabar y añadir los vídeos de la videoteca.
- Foto de María para «Sobre mí» (guardar como `assets/maria.jpg` y sustituir el logo del recuadro).
- PDF de la guía de 7 ejercicios para la espalda (se pide por WhatsApp desde la web).
- Opiniones reales de alumnas.
- Cobro con tarjeta online (Stripe), si se quiere más adelante.
- Dominio propio (por ejemplo, mobatraining.es).
