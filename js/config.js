/* ============================================================
   CONFIGURACIÓN DE MOBA TRAINING
   Aquí se cambian los datos del negocio. Los precios, las clases,
   los vídeos y las alumnas se gestionan desde el panel de María
   (se guardan en la base de datos).
   ============================================================ */
window.MOBA = {
  nombre: 'Moba Training',
  profesora: 'María Hernández Cuellar',
  // WhatsApp con prefijo de país y sin espacios (se usa para los enlaces wa.me)
  whatsapp: '34682012956',
  whatsappVisible: '682 01 29 56',
  email: '',                 // email de contacto público (opcional)
  instagram: '',             // usuario de Instagram sin @ (opcional)

  // Pagos: Bizum al WhatsApp de arriba; IBAN para transferencias (opcional)
  iban: '',

  // Datos fiscales para las facturas (rellenar antes de facturar)
  fiscal: {
    titular: 'María Hernández Cuellar',
    nif: '',
    direccion: '',
    iva: 21                  // % de IVA incluido en los precios
  },

  // Normas que se muestran en la web y se aplican en el servidor
  horasCancelacion: 8,
  plazasGrupo: 6,

  // Conexión con la base de datos. Esta clave es pública por diseño:
  // lo que protege los datos son las reglas de seguridad del servidor.
  supabase: {
    url: 'https://qvzkkrvruknxyrmktkmw.supabase.co',
    clave: 'sb_publishable_IBUGSruYoLZi95uMpNavOA_gqldGOCO'
  }
};
