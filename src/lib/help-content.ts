/**
 * Contenido de la sección de Ayuda contextual.
 * Cada bloque describe una pantalla con pasos, un ejemplo real y enlaces
 * directos a las rutas relacionadas. Bilingüe ES/EN.
 */

export type HelpLink = { to: string; es: string; en: string };

export type HelpSection = {
  /** Ancla usada en /ayuda?screen=<id> */
  id: string;
  /** Rutas de la app que abren esta ayuda de forma contextual */
  routes: string[];
  title: { es: string; en: string };
  summary: { es: string; en: string };
  steps: { es: string; en: string }[];
  example: { es: string; en: string };
  links: HelpLink[];
};

export const HELP_SECTIONS: HelpSection[] = [
  {
    id: "mi-equipo",
    routes: ["/mi-equipo", "/miembros"],
    title: { es: "Mi Equipo", en: "My Team" },
    summary: {
      es: "Crea tu equipo, gestiona a los miembros y decide si las inscripciones están abiertas. Si aún no tienes equipo, aquí puedes buscar uno y enviar una solicitud.",
      en: "Create your team, manage members and decide whether sign-ups are open. If you don't have a team yet, search for one and send a join request here.",
    },
    steps: [
      {
        es: "Capitán: pulsa «Crear equipo», elige nombre, ciudad y deporte (actualmente Pádel) y guarda.",
        en: "Captain: tap “Create team”, choose name, city and sport (currently Padel) and save.",
      },
      {
        es: "Abre o cierra las inscripciones con el interruptor para controlar quién puede solicitar unirse.",
        en: "Open or close sign-ups with the toggle to control who can request to join.",
      },
      {
        es: "Revisa las solicitudes pendientes y apruébalas o recházalas desde Miembros.",
        en: "Review pending requests and approve or reject them from Members.",
      },
      {
        es: "Asigna roles: co-capitán, entrenador, delegado o jugador. El co-capitán tiene los mismos permisos de gestión que el capitán.",
        en: "Assign roles: co-captain, coach, staff or player. Co-captains have the same management permissions as the captain.",
      },
      {
        es: "Jugador: usa el buscador, filtra por deporte o ciudad y pulsa «Solicitar unirme».",
        en: "Player: use the finder, filter by sport or city and tap “Request to join”.",
      },
    ],
    example: {
      es: "Ejemplo: creas «Padel Club Norte», dejas las inscripciones abiertas una semana, recibes 6 solicitudes, apruebas 4 y nombras co-capitán a quien te ayuda a montar los partidos.",
      en: "Example: you create “Padel Club Norte”, keep sign-ups open for a week, receive 6 requests, approve 4 and promote a co-captain to help you set up matches.",
    },
    links: [
      { to: "/mi-equipo", es: "Ir a Mi Equipo", en: "Go to My Team" },
      { to: "/miembros", es: "Gestionar miembros", en: "Manage members" },
    ],
  },
  {
    id: "calendario",
    routes: ["/calendario", "/entrenamientos", "/enfrentamientos", "/competiciones"],
    title: { es: "Calendario", en: "Calendar" },
    summary: {
      es: "Toda la actividad del equipo en un solo sitio: entrenamientos, enfrentamientos, torneos y reuniones, en vista de semana o mes.",
      en: "All team activity in one place: trainings, matches, tournaments and meetings, in week or month view.",
    },
    steps: [
      {
        es: "Cambia entre vista de semana y mes con los botones superiores.",
        en: "Switch between week and month view with the top buttons.",
      },
      {
        es: "Capitán o co-capitán: pulsa «Crear evento», elige el tipo (Entrenamiento, Enfrentamiento, Torneo, Reunión) y la fecha.",
        en: "Captain or co-captain: tap “Create event”, pick the type (Training, Match, Tournament, Meeting) and the date.",
      },
      {
        es: "Activa «Requiere convocatoria» y fija una fecha de cierre para que los jugadores confirmen a tiempo.",
        en: "Enable “Requires call-up” and set a closing date so players confirm in time.",
      },
      {
        es: "Los torneos admiten varios días: indica fecha de inicio y fin y aparecerán en todas las jornadas.",
        en: "Tournaments can span several days: set a start and end date and they'll show on every day.",
      },
      {
        es: "Pulsa cualquier evento para ver el detalle, la lista de apuntados y, si ya pasó, registrar resultados.",
        en: "Tap any event to see details, the sign-up list and, once it's over, record results.",
      },
    ],
    example: {
      es: "Ejemplo: creas un entrenamiento los martes a las 19:00 y un enfrentamiento el sábado con cierre de convocatoria el jueves a las 22:00.",
      en: "Example: you create a training every Tuesday at 19:00 and a match on Saturday with call-ups closing Thursday at 22:00.",
    },
    links: [
      { to: "/calendario", es: "Abrir Calendario", en: "Open Calendar" },
      { to: "/entrenamientos", es: "Entrenamientos", en: "Trainings" },
      { to: "/enfrentamientos", es: "Enfrentamientos", en: "Matches" },
    ],
  },
  {
    id: "convocatorias",
    routes: ["/convocatorias", "/resultados", "/estadisticas"],
    title: { es: "Convocatorias", en: "Call-ups" },
    summary: {
      es: "Los jugadores se apuntan a los eventos abiertos y el capitán elige quién juega. En pádel, además, se asignan parejas por pista.",
      en: "Players sign up for open events and the captain picks who plays. In padel you also assign pairs per court.",
    },
    steps: [
      {
        es: "Jugador: abre la convocatoria, revisa fecha, hora y sede y pulsa «Apuntarme». Puedes cancelar mientras siga abierta.",
        en: "Player: open the call-up, check date, time and venue and tap “Sign me up”. You can withdraw while it stays open.",
      },
      {
        es: "Capitán: consulta la lista de apuntados y selecciona a los jugadores definitivos en el apartado «Convocados».",
        en: "Captain: review who signed up and pick the final squad in the “Called up” section.",
      },
      {
        es: "En pádel indica el número de pistas y asigna 2 jugadores por pista, empezando por la Pista 1.",
        en: "In padel set the number of courts and assign 2 players per court, starting with Court 1.",
      },
      {
        es: "Al publicar la convocatoria, los convocados reciben una notificación (y push si la tienen activada).",
        en: "When you publish the call-up, selected players get a notification (and a push if enabled).",
      },
      {
        es: "Tras el partido, introduce los resultados por pista (3 sets en pádel) y las estadísticas se actualizan solas.",
        en: "After the match, enter results per court (3 sets in padel) and stats update automatically.",
      },
    ],
    example: {
      es: "Ejemplo: 9 jugadores se apuntan al sábado, convocas a 8 y los repartes en 4 pistas; el domingo registras 3 pistas ganadas y el sistema marca la victoria del equipo.",
      en: "Example: 9 players sign up for Saturday, you call up 8 and split them across 4 courts; on Sunday you record 3 courts won and the system marks the team win.",
    },
    links: [
      { to: "/convocatorias", es: "Ver convocatorias", en: "View call-ups" },
      { to: "/resultados", es: "Registrar resultados", en: "Record results" },
      { to: "/estadisticas", es: "Ver estadísticas", en: "View stats" },
    ],
  },
  {
    id: "encuestas",
    routes: ["/encuestas"],
    title: { es: "Encuestas", en: "Polls" },
    summary: {
      es: "Decide en equipo: horarios, pistas, equipación o cualquier duda, con voto único o múltiple y resultados en tiempo real.",
      en: "Decide as a team: schedules, courts, kit or anything else, with single or multiple choice and live results.",
    },
    steps: [
      {
        es: "Capitán o co-capitán: pulsa «Nueva encuesta», escribe la pregunta y añade las opciones.",
        en: "Captain or co-captain: tap “New poll”, write the question and add the options.",
      },
      {
        es: "Elige si permite varias respuestas, si es anónima y cuándo se cierra.",
        en: "Choose whether it allows multiple answers, whether it's anonymous and when it closes.",
      },
      {
        es: "Jugador: vota desde la lista; verás las barras de resultados al instante.",
        en: "Player: vote from the list; you'll see the result bars instantly.",
      },
      {
        es: "El gestor puede cerrar, reabrir o cancelar la encuesta antes de la fecha límite.",
        en: "Managers can close, reopen or cancel a poll before its deadline.",
      },
    ],
    example: {
      es: "Ejemplo: «¿A qué hora entrenamos el jueves?» con opciones 18:00 / 19:00 / 20:00, cierre el miércoles a las 20:00 y voto no anónimo para saber quién falta por responder.",
      en: "Example: “What time do we train on Thursday?” with 18:00 / 19:00 / 20:00, closing Wednesday at 20:00 and non-anonymous voting so you can chase pending replies.",
    },
    links: [{ to: "/encuestas", es: "Ir a Encuestas", en: "Go to Polls" }],
  },
  {
    id: "chat",
    routes: ["/comunicaciones"],
    title: { es: "Chat y comunicaciones", en: "Chat & communications" },
    summary: {
      es: "Canales del equipo en tiempo real: uno general, uno de staff y los privados que crees, con invitación por enlace.",
      en: "Real-time team channels: a general one, a staff one and any private channels you create, with link invites.",
    },
    steps: [
      {
        es: "Selecciona un canal en la lista lateral para leer y escribir mensajes.",
        en: "Pick a channel from the side list to read and write messages.",
      },
      {
        es: "Responde a un mensaje concreto para mantener el hilo claro; puedes editar los tuyos.",
        en: "Reply to a specific message to keep the thread clear; you can edit your own.",
      },
      {
        es: "Capitán o co-capitán: crea canales personalizados y elige qué miembros entran.",
        en: "Captain or co-captain: create custom channels and choose which members join.",
      },
      {
        es: "Comparte el enlace de invitación del canal para que alguien se una con un clic.",
        en: "Share the channel invite link so someone can join with one click.",
      },
      {
        es: "Activa las notificaciones push en Perfil para enterarte de los mensajes nuevos.",
        en: "Enable push notifications in Profile to get new messages.",
      },
    ],
    example: {
      es: "Ejemplo: creas el canal «Equipo A – Liga» con los 8 convocados y compartes el enlace en el general para que se apunte el suplente.",
      en: "Example: you create the “Team A – League” channel with the 8 called-up players and share the link in the general channel so the substitute can join.",
    },
    links: [
      { to: "/comunicaciones", es: "Abrir el chat", en: "Open chat" },
      { to: "/perfil", es: "Ajustes de notificaciones", en: "Notification settings" },
    ],
  },
];

/** Devuelve el id de la sección de ayuda que corresponde a una ruta. */
export function helpSectionForPath(pathname: string): string | undefined {
  return HELP_SECTIONS.find((s) => s.routes.some((r) => pathname.startsWith(r)))?.id;
}
