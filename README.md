# Moba Training

Web de clases online de pilates, yoga y entrenamiento funcional de **María Hernández Cuellar**.

- `index.html` — web pública: horario real, test, tarifas, videoteca, retos, sobre mí, regalo, guía gratis y preguntas frecuentes.
- `cuenta.html` — área de la alumna: registro, reservas, bonos y pagos, videoteca y perfil.
- `panel.html` — panel de María: resumen, agenda, alumnas, facturación, bajas y avisos, vídeos, tarifas y contactos.
- `legal.html` — aviso legal, privacidad, cookies y condiciones de reserva.

HTML, CSS y JavaScript sin compilación. Base de datos y cuentas en Supabase (proyecto `moba-training`, id `qvzkkrvruknxyrmktkmw`, región París). Publicada con GitHub Pages.

## Primeros pasos (una sola vez)

1. **María se registra la primera** en `cuenta.html`. La primera cuenta que se crea queda como profesora (administradora); todas las demás son alumnas.
2. Rellenar en `js/config.js` los datos fiscales (NIF y domicilio), y si se quiere, el IBAN, el email y el Instagram.
3. Desde el panel, en **Agenda**: crear las clases en grupo (con «Repetir cada semana») y abrir los huecos de entrenamiento personal.

## Cómo funciona

- **Clases en directo:** por videollamada de WhatsApp. Al reservar, la alumna ve que María la llamará a su número. En la agenda, «Ver» muestra los teléfonos de cada clase, con botón de WhatsApp y «Copiar teléfonos» para montar el grupo.
- **Grupos de máximo 6 personas** (lo controla la base de datos).
- **Primera clase en grupo gratis:** se crea sola al reservar la primera vez.
- **Pagos:** la alumna solicita el bono y paga por Bizum, transferencia o en mano. María pulsa «Confirmar pago» y el bono se activa ese día y recibe número de factura. Las ventas cobradas en mano se registran con «Registrar venta».
- **Cancelaciones:** hasta 8 h antes, la clase vuelve al bono.
- **Avisos de renovación:** en «Bajas y avisos» y en el resumen, «Avisar» abre un borrador de Gmail con un mensaje de motivación para renovar. Queda anotado cuándo se avisó.
- **Posibles bajas:** alumnas sin clases en 21 días o con el bono terminado sin renovar.
- **Vídeos:** se suben a Vimeo, YouTube (oculto) o Google Drive y se pega el enlace en «Vídeos». Solo lo pueden abrir las alumnas con videoteca o Moba Completo (o todas si se marca «Gratis»).

## Base de datos

Las migraciones están en `supabase/migrations/`. Las alumnas solo escriben a través de funciones del servidor (`reservar`, `cancelar_reserva`, `solicitar_bono`, `actualizar_perfil`, `darme_de_baja`, `ver_video`); el panel usa los permisos de administradora. El enlace de los vídeos nunca se envía a quien no tiene acceso.

## Pendiente

- Grabar y añadir los vídeos de la videoteca.
- Foto de María para «Sobre mí» (guardar como `assets/maria.jpg` y sustituir el logo del recuadro).
- PDF de la guía de 7 ejercicios para la espalda.
- Opiniones reales de alumnas.
- Cobro con tarjeta online (Stripe), si se quiere más adelante.
- Dominio propio (por ejemplo, mobatraining.es).
