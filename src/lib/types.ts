/**
 * Los tipos del dominio, tal como los devuelve la API de Django.
 *
 * Sustituyen a `Database["public"]["Tables"][...]["Row"]`, que generaba
 * Supabase. Los nombres de columna son los mismos, así que las pantallas no
 * cambian de vocabulario; lo que cambia es de dónde salen.
 */

export type AppRole = "admin" | "user";
export type ChannelScope = "general" | "staff" | "custom";
export type CompetitionType = "liga" | "copa" | "torneo" | "amistoso";
export type EventType = "entrenamiento" | "partido" | "reunion" | "otro" | "torneo";
export type InvitationStatus = "pendiente" | "aceptada" | "rechazada";
export type MemberStatus = "pendiente" | "activo" | "expulsado";
export type PreferredRole = "capitan" | "jugador";
export type RegistrationStatus = "abierta" | "activa" | "cerrada" | "rechazada";
export type ResponseStatus = "convocado" | "confirmado" | "rechazado" | "duda";
export type TeamRole = "capitan" | "entrenador" | "delegado" | "jugador" | "co_capitan";

/** Los roles que dan permisos de gestión sobre un equipo. */
export const MANAGER_ROLES: TeamRole[] = ["capitan", "co_capitan", "entrenador", "delegado"];

export type Profile = {
  id: string;
  email: string;
  nombre: string;
  apellidos: string;
  avatar_url: string | null;
};

export type FullProfile = Profile & {
  telefono: string | null;
  fecha_nacimiento: string | null;
  ciudad: string | null;
  descripcion: string | null;
  deporte: string | null;
  posicion: string | null;
  nivel: string | null;
  mano_dominante: string | null;
  preferred_role: PreferredRole | null;
  idioma: string;
  onboarding_completed: boolean;
  reminder_hours: number[];
};

export type Team = {
  id: string;
  owner_id: string;
  nombre: string;
  logo_url: string | null;
  descripcion: string | null;
  deporte: string | null;
  categoria: string | null;
  ciudad: string | null;
  color_primario: string | null;
  color_secundario: string | null;
  instalacion: string | null;
  inscripciones_abiertas: boolean;
  member_count: number;
  created_at: string;
  updated_at: string;
};

export type TeamMember = {
  id: string;
  team_id: string;
  user_id: string;
  role: TeamRole;
  status: MemberStatus;
  joined_at: string;
  team: Team;
  profile: Profile | null;
};

export type TeamInvitation = {
  id: string;
  team_id: string;
  invited_user_id: string;
  invited_by_id: string;
  role: TeamRole;
  status: InvitationStatus;
  mensaje: string | null;
  es_solicitud: boolean;
  responded_at: string | null;
  created_at: string;
  team: Team;
  invited_user_profile: Profile | null;
  inviter_profile: Profile | null;
};

export type TeamEvent = {
  id: string;
  team_id: string;
  created_by_id: string;
  competition_id: string | null;
  registration_id: string | null;
  tipo: EventType;
  titulo: string;
  descripcion: string | null;
  ubicacion: string | null;
  fecha_inicio: string;
  fecha_fin: string | null;
  requiere_convocatoria: boolean;
  convocatoria_cierra_en: string | null;
  rival: string | null;
  es_local: boolean | null;
  resultado_local: number | null;
  resultado_visitante: number | null;
  padel_num_pistas: number | null;
  competition_nombre: string | null;
  team_nombre: string;
  created_at: string;
  updated_at: string;
};

export type EventResponse = {
  id: string;
  event_id: string;
  user_id: string;
  status: ResponseStatus;
  es_convocado: boolean;
  notas: string | null;
  padel_pista: number | null;
  responded_at: string | null;
  profile: Profile | null;
  event_tipo: EventType;
  event_fecha_inicio: string;
  event_titulo: string;
};

export type MatchResult = {
  id: string;
  event_id: string;
  pista: number;
  set1_local: number | null;
  set1_visitante: number | null;
  set2_local: number | null;
  set2_visitante: number | null;
  set3_local: number | null;
  set3_visitante: number | null;
};

export type MatchParticipation = {
  id: string;
  event_id: string;
  team_id: string;
  user_id: string;
  fecha: string;
  jugado: boolean;
  pista: number | null;
  ganado: boolean | null;
  event_ganado: boolean | null;
  profile: Profile | null;
};

export type Competition = {
  id: string;
  team_id: string;
  created_by_id: string;
  nombre: string;
  descripcion: string | null;
  tipo: CompetitionType;
  temporada: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
};

export type OfficialCompetitionItem = {
  id: string;
  competition_id: string;
  code: string;
  nombre: string;
  orden: number;
};

export type OfficialCompetition = {
  id: string;
  code: string;
  nombre: string;
  descripcion: string | null;
  reglas: string | null;
  temporada_actual: string | null;
  activa: boolean;
  inscripciones_abiertas: boolean;
  orden: number;
  categories: OfficialCompetitionItem[];
  divisions: OfficialCompetitionItem[];
};

export type CompetitionRegistration = {
  id: string;
  competition_id: string;
  team_id: string;
  category_id: string;
  division_id: string;
  created_by_id: string | null;
  status: RegistrationStatus;
  temporada: string | null;
  registered_at: string;
  competition_nombre: string;
  category_nombre: string;
  division_nombre: string;
  team_nombre: string;
};

export type ChatChannel = {
  id: string;
  team_id: string;
  created_by_id: string | null;
  nombre: string;
  scope: ChannelScope;
  invite_token: string | null;
};

export type ChatChannelMember = {
  id: string;
  channel_id: string;
  user_id: string;
  added_at: string;
  profile: Profile | null;
};

export type ChatMessage = {
  id: string;
  channel_id: string;
  user_id: string;
  reply_to_id: string | null;
  contenido: string;
  edited: boolean;
  profile: Profile | null;
  created_at: string;
};

export type PollOption = {
  id: string;
  poll_id: string;
  texto: string;
  posicion: number;
  vote_count: number;
};

export type Poll = {
  id: string;
  team_id: string;
  created_by_id: string;
  pregunta: string;
  descripcion: string | null;
  multi_select: boolean;
  anonymous: boolean;
  closed: boolean;
  closes_at: string | null;
  options: PollOption[];
  my_votes: string[];
  voter_count: number;
  created_at: string;
};

export type TeamDocument = {
  id: string;
  team_id: string;
  uploader_id: string;
  url: string | null;
  filename: string;
  category: string | null;
  size_bytes: number | null;
  mime_type: string | null;
  created_at: string;
};

export type GalleryItem = {
  id: string;
  team_id: string;
  event_id: string | null;
  uploader_id: string;
  url: string | null;
  caption: string | null;
  created_at: string;
};

export type TeamFee = {
  id: string;
  team_id: string;
  created_by_id: string;
  concepto: string;
  amount: string;
  currency: string;
  due_date: string | null;
  created_at: string;
};

export type FeePayment = {
  id: string;
  fee_id: string;
  user_id: string;
  status: string;
  paid_at: string | null;
  notas: string | null;
  profile: Profile | null;
};

export type Notification = {
  id: string;
  user_id: string;
  tipo: string;
  titulo: string;
  cuerpo: string | null;
  link: string | null;
  data: unknown;
  read: boolean;
  created_at: string;
};

export type TeamStats = {
  team_id: string;
  jugados: number;
  ganados: number;
  perdidos: number;
  win_pct: number;
  pistas_ganadas: number;
  pistas_perdidas: number;
  diferencia_pistas: number;
  racha: number;
  racha_victorias: boolean;
} | null;

export type PlayerStats = {
  user_id: string;
  team_id: string;
  convocado: number;
  disputados: number;
  victorias: number;
  derrotas: number;
  win_pct: number;
  ultima_convocatoria: string | null;
  ultimo_partido: string | null;
};
