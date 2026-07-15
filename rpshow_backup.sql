--
-- PostgreSQL database dump
--

\restrict trykheeT1KLwzQPYwToMAe5dQR2izOZUzekNaDhNI6OqUHP42UEKbXR1znfaqpS

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: activity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.activity (
    id integer NOT NULL,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_name text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    user_id text,
    entity_id integer,
    screen_id integer,
    playlist_id integer,
    screen_status text,
    details text
);


--
-- Name: activity_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.activity_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: activity_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.activity_id_seq OWNED BY public.activity.id;


--
-- Name: brightness_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.brightness_schedules (
    id integer NOT NULL,
    screen_id integer NOT NULL,
    start_time text NOT NULL,
    end_time text NOT NULL,
    brightness integer NOT NULL,
    days text DEFAULT '0,1,2,3,4,5,6'::text NOT NULL,
    label text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: brightness_schedules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.brightness_schedules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: brightness_schedules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.brightness_schedules_id_seq OWNED BY public.brightness_schedules.id;


--
-- Name: clients; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.clients (
    id integer NOT NULL,
    name text NOT NULL,
    type text DEFAULT 'other'::text NOT NULL,
    contact_name text,
    contact_phone text,
    address text,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    user_id text,
    cnpj text,
    segment text
);


--
-- Name: clients_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.clients_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: clients_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.clients_id_seq OWNED BY public.clients.id;


--
-- Name: devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.devices (
    id integer NOT NULL,
    serial text NOT NULL,
    name text,
    location text,
    notes text,
    status text DEFAULT 'pending'::text NOT NULL,
    screen_code text,
    user_id text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    approved_at timestamp without time zone
);


--
-- Name: devices_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.devices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: devices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.devices_id_seq OWNED BY public.devices.id;


--
-- Name: emergency_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.emergency_alerts (
    id integer NOT NULL,
    user_id text,
    message text NOT NULL,
    bg_color text DEFAULT '#DC2626'::text NOT NULL,
    text_color text DEFAULT '#FFFFFF'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    expires_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: emergency_alerts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.emergency_alerts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: emergency_alerts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.emergency_alerts_id_seq OWNED BY public.emergency_alerts.id;


--
-- Name: locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.locations (
    id integer NOT NULL,
    user_id text,
    name text NOT NULL,
    abbreviation text,
    address text,
    city text,
    latitude text,
    longitude text,
    image_url text,
    audience integer,
    audience_unit text DEFAULT 'pessoas/hora'::text,
    timezone text DEFAULT 'America/Sao_Paulo'::text,
    internal_id text,
    production_type text,
    description text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: locations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.locations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: locations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.locations_id_seq OWNED BY public.locations.id;


--
-- Name: media; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media (
    id integer NOT NULL,
    name text NOT NULL,
    type text DEFAULT 'image'::text NOT NULL,
    url text NOT NULL,
    thumbnail_url text,
    duration_seconds integer DEFAULT 10,
    client_id integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    user_id text,
    meta_json text
);


--
-- Name: media_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.media_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: media_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.media_id_seq OWNED BY public.media.id;


--
-- Name: media_plays; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.media_plays (
    id integer NOT NULL,
    screen_id integer,
    screen_code text NOT NULL,
    screen_name text NOT NULL,
    media_id integer,
    media_name text NOT NULL,
    media_type text NOT NULL,
    played_at timestamp without time zone DEFAULT now() NOT NULL,
    duration_seconds integer,
    user_id text,
    campaign_group_id text,
    client_name text,
    playlist_id integer
);


--
-- Name: media_plays_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.media_plays_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: media_plays_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.media_plays_id_seq OWNED BY public.media_plays.id;


--
-- Name: operators; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.operators (
    id integer NOT NULL,
    username text NOT NULL,
    password_hash text NOT NULL,
    name text NOT NULL,
    role text DEFAULT 'operator'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    onboarding_done boolean DEFAULT false NOT NULL,
    segment text,
    job_role text,
    screen_count text,
    totp_secret text,
    totp_enabled boolean DEFAULT false NOT NULL,
    email text,
    phone text,
    subscription_status text DEFAULT 'trial'::text NOT NULL,
    trial_ends_at timestamp without time zone,
    trial_days integer DEFAULT 30 NOT NULL,
    monthly_amount text DEFAULT '0.00'::text NOT NULL,
    price_per_screen text DEFAULT '50.00'::text NOT NULL,
    blocked boolean DEFAULT false NOT NULL
);


--
-- Name: operators_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.operators_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: operators_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.operators_id_seq OWNED BY public.operators.id;


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_tokens (
    id integer NOT NULL,
    operator_id integer NOT NULL,
    token text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    used boolean DEFAULT false NOT NULL
);


--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.password_reset_tokens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.password_reset_tokens_id_seq OWNED BY public.password_reset_tokens.id;


--
-- Name: playlist_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.playlist_items (
    id integer NOT NULL,
    playlist_id integer NOT NULL,
    media_id integer NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    duration_seconds integer DEFAULT 10 NOT NULL,
    object_fit text DEFAULT 'contain'::text NOT NULL
);


--
-- Name: playlist_items_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.playlist_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: playlist_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.playlist_items_id_seq OWNED BY public.playlist_items.id;


--
-- Name: playlists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.playlists (
    id integer NOT NULL,
    name text NOT NULL,
    client_id integer,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    user_id text,
    layout_json text,
    transition_effect text DEFAULT 'fade'::text NOT NULL,
    resolution_width smallint DEFAULT 1920,
    resolution_height smallint DEFAULT 1080,
    published_snapshot_json text,
    published_at timestamp without time zone
);


--
-- Name: playlists_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.playlists_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: playlists_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.playlists_id_seq OWNED BY public.playlists.id;


--
-- Name: schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schedules (
    id integer NOT NULL,
    screen_id integer NOT NULL,
    playlist_id integer NOT NULL,
    start_time text,
    end_time text,
    days_of_week text,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    name text,
    start_at timestamp without time zone,
    end_at timestamp without time zone,
    client_name text,
    campaign_group_id text,
    end_notified_at timestamp without time zone
);


--
-- Name: schedules_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.schedules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: schedules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.schedules_id_seq OWNED BY public.schedules.id;


--
-- Name: screen_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.screen_connections (
    id integer NOT NULL,
    screen_id integer NOT NULL,
    connected_at timestamp without time zone NOT NULL,
    disconnected_at timestamp without time zone
);


--
-- Name: screen_connections_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.screen_connections_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: screen_connections_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.screen_connections_id_seq OWNED BY public.screen_connections.id;


--
-- Name: screen_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.screen_groups (
    id integer NOT NULL,
    user_id text,
    name text NOT NULL,
    color text DEFAULT '#3B82F6'::text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: screen_groups_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.screen_groups_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: screen_groups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.screen_groups_id_seq OWNED BY public.screen_groups.id;


--
-- Name: screens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.screens (
    id integer NOT NULL,
    name text NOT NULL,
    client_id integer,
    code text NOT NULL,
    location text,
    status text DEFAULT 'unknown'::text NOT NULL,
    last_seen timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    user_id text,
    default_playlist_id integer,
    resolution text,
    tags text,
    last_screenshot text,
    power_on_time text,
    power_off_time text,
    power_schedule_json text,
    timezone text DEFAULT 'America/Sao_Paulo'::text NOT NULL,
    group_id integer,
    blocked boolean DEFAULT false NOT NULL,
    panel_width integer,
    panel_height integer,
    price text,
    online_since timestamp without time zone,
    panel_rotation integer DEFAULT 0 NOT NULL,
    target_brightness integer
);


--
-- Name: screens_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.screens_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: screens_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.screens_id_seq OWNED BY public.screens.id;


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    sid character varying NOT NULL,
    sess jsonb NOT NULL,
    expire timestamp without time zone NOT NULL
);


--
-- Name: subscription_payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscription_payments (
    id integer NOT NULL,
    operator_id integer NOT NULL,
    reference_month text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    amount text DEFAULT '80.00'::text NOT NULL,
    notes text,
    paid_at timestamp without time zone,
    due_date timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    screen_id integer,
    payment_type text
);


--
-- Name: subscription_payments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.subscription_payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: subscription_payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.subscription_payments_id_seq OWNED BY public.subscription_payments.id;


--
-- Name: trusted_devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trusted_devices (
    id integer NOT NULL,
    operator_id integer NOT NULL,
    token text NOT NULL,
    device_name text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    expires_at timestamp without time zone NOT NULL
);


--
-- Name: trusted_devices_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.trusted_devices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: trusted_devices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.trusted_devices_id_seq OWNED BY public.trusted_devices.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    email character varying,
    first_name character varying,
    last_name character varying,
    profile_image_url character varying,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    pairing_code character varying(8)
);


--
-- Name: activity id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity ALTER COLUMN id SET DEFAULT nextval('public.activity_id_seq'::regclass);


--
-- Name: brightness_schedules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brightness_schedules ALTER COLUMN id SET DEFAULT nextval('public.brightness_schedules_id_seq'::regclass);


--
-- Name: clients id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients ALTER COLUMN id SET DEFAULT nextval('public.clients_id_seq'::regclass);


--
-- Name: devices id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices ALTER COLUMN id SET DEFAULT nextval('public.devices_id_seq'::regclass);


--
-- Name: emergency_alerts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emergency_alerts ALTER COLUMN id SET DEFAULT nextval('public.emergency_alerts_id_seq'::regclass);


--
-- Name: locations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations ALTER COLUMN id SET DEFAULT nextval('public.locations_id_seq'::regclass);


--
-- Name: media id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media ALTER COLUMN id SET DEFAULT nextval('public.media_id_seq'::regclass);


--
-- Name: media_plays id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_plays ALTER COLUMN id SET DEFAULT nextval('public.media_plays_id_seq'::regclass);


--
-- Name: operators id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operators ALTER COLUMN id SET DEFAULT nextval('public.operators_id_seq'::regclass);


--
-- Name: password_reset_tokens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens ALTER COLUMN id SET DEFAULT nextval('public.password_reset_tokens_id_seq'::regclass);


--
-- Name: playlist_items id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.playlist_items ALTER COLUMN id SET DEFAULT nextval('public.playlist_items_id_seq'::regclass);


--
-- Name: playlists id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.playlists ALTER COLUMN id SET DEFAULT nextval('public.playlists_id_seq'::regclass);


--
-- Name: schedules id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedules ALTER COLUMN id SET DEFAULT nextval('public.schedules_id_seq'::regclass);


--
-- Name: screen_connections id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.screen_connections ALTER COLUMN id SET DEFAULT nextval('public.screen_connections_id_seq'::regclass);


--
-- Name: screen_groups id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.screen_groups ALTER COLUMN id SET DEFAULT nextval('public.screen_groups_id_seq'::regclass);


--
-- Name: screens id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.screens ALTER COLUMN id SET DEFAULT nextval('public.screens_id_seq'::regclass);


--
-- Name: subscription_payments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_payments ALTER COLUMN id SET DEFAULT nextval('public.subscription_payments_id_seq'::regclass);


--
-- Name: trusted_devices id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trusted_devices ALTER COLUMN id SET DEFAULT nextval('public.trusted_devices_id_seq'::regclass);


--
-- Data for Name: activity; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.activity (id, action, entity_type, entity_name, created_at, user_id, entity_id, screen_id, playlist_id, screen_status, details) FROM stdin;
1	created	client	Posto Bela Vista	2026-06-27 20:08:50.123583	\N	\N	\N	\N	\N	\N
2	created	client	Clínica Saúde & Vida	2026-06-27 20:08:50.123583	\N	\N	\N	\N	\N	\N
3	created	screen	TV Entrada	2026-06-27 20:08:50.123583	\N	\N	\N	\N	\N	\N
4	created	playlist	Promoções Posto Bela Vista	2026-06-27 20:08:50.123583	\N	\N	\N	\N	\N	\N
5	scheduled	schedule	Promoções Posto Bela Vista → TV Entrada	2026-06-27 20:08:50.123583	\N	\N	\N	\N	\N	\N
6	deleted	client	Posto Bela Vista	2026-06-27 21:45:22.287615	\N	\N	\N	\N	\N	\N
7	deleted	client	Clínica Saúde & Vida	2026-06-27 21:45:25.13941	\N	\N	\N	\N	\N	\N
8	deleted	client	Posto Rodoanel	2026-06-27 21:45:27.536144	\N	\N	\N	\N	\N	\N
9	created	client	RPSHOW	2026-06-27 21:46:01.13263	\N	\N	\N	\N	\N	\N
10	created	screen	TV SALA	2026-06-27 21:46:57.634647	\N	\N	\N	\N	\N	\N
11	deleted	media	Promoção Gasolina - 10% OFF	2026-06-27 21:47:30.985024	\N	\N	\N	\N	\N	\N
12	deleted	media	Desconto Óleo Lubrificante	2026-06-27 21:47:32.696111	\N	\N	\N	\N	\N	\N
13	deleted	media	Consulta Preventiva em Promoção	2026-06-27 21:47:34.306086	\N	\N	\N	\N	\N	\N
14	deleted	media	Plano Saúde Familiar	2026-06-27 21:47:35.934202	\N	\N	\N	\N	\N	\N
15	deleted	media	Lavagem Completa R$29,90	2026-06-27 21:47:37.625457	\N	\N	\N	\N	\N	\N
16	uploaded	media	Design sem nome (10).png	2026-06-27 21:47:51.973973	\N	\N	\N	\N	\N	\N
17	uploaded	media	Geração_de_Vídeo_Concluída.mp4	2026-06-27 21:48:11.125328	\N	\N	\N	\N	\N	\N
18	uploaded	media	Design sem nome (11).png	2026-06-27 21:48:23.434858	\N	\N	\N	\N	\N	\N
19	deleted	playlist	Promoções Posto Bela Vista	2026-06-27 21:48:57.511438	\N	\N	\N	\N	\N	\N
20	deleted	playlist	Programação Clínica	2026-06-27 21:49:00.108931	\N	\N	\N	\N	\N	\N
21	deleted	playlist	Ofertas Posto Rodoanel	2026-06-27 21:49:02.439125	\N	\N	\N	\N	\N	\N
22	created	playlist	comercial	2026-06-27 21:49:09.89968	\N	\N	\N	\N	\N	\N
23	scheduled	schedule	comercial → TV SALA	2026-06-27 21:50:28.696099	\N	\N	\N	\N	\N	\N
24	uploaded	media	logo-rpshow-sem-fundo.png	2026-06-27 22:22:56.488958	\N	\N	\N	\N	\N	\N
25	uploaded	media	ChatGPT Image 29 de abr. de 2026, 11_42_43.png	2026-06-27 22:23:11.126339	\N	\N	\N	\N	\N	\N
26	uploaded	media	ChatGPT Image 29 de abr. de 2026, 11_52_24.png	2026-06-27 22:23:22.234052	\N	\N	\N	\N	\N	\N
27	created	screen	SALA	2026-06-27 23:04:34.998315	\N	\N	\N	\N	\N	\N
28	deleted	playlist	comercial	2026-06-27 23:04:54.142995	\N	\N	\N	\N	\N	\N
29	created	playlist	comercial	2026-06-27 23:05:05.406087	\N	\N	\N	\N	\N	\N
30	scheduled	schedule	comercial → TV SALA	2026-06-27 23:05:39.98777	\N	\N	\N	\N	\N	\N
31	scheduled	schedule	comercial → SALA	2026-06-27 23:05:48.635469	\N	\N	\N	\N	\N	\N
32	deleted	screen	TV SALA	2026-06-27 23:12:19.17048	\N	\N	\N	\N	\N	\N
33	deleted	screen	SALA	2026-06-27 23:13:10.346772	\N	\N	\N	\N	\N	\N
34	created	screen	comercial	2026-06-27 23:13:21.793117	\N	\N	\N	\N	\N	\N
35	uploaded	media	Design sem nome (12).png	2026-06-27 23:13:38.496455	\N	\N	\N	\N	\N	\N
36	uploaded	media	Design sem nome (9).png	2026-06-27 23:13:38.49838	\N	\N	\N	\N	\N	\N
37	uploaded	media	Design sem nome (11).png	2026-06-27 23:13:38.499509	\N	\N	\N	\N	\N	\N
38	uploaded	media	Design sem nome (10).png	2026-06-27 23:13:38.504008	\N	\N	\N	\N	\N	\N
39	uploaded	media	WhatsApp Video 2026-03-31 at 13.51.19.mp4	2026-06-27 23:14:03.880642	\N	\N	\N	\N	\N	\N
40	uploaded	media	Design sem nome (4).mp4	2026-06-27 23:14:03.882738	\N	\N	\N	\N	\N	\N
41	deleted	playlist	comercial	2026-06-27 23:14:16.734019	\N	\N	\N	\N	\N	\N
42	created	playlist	comercial	2026-06-27 23:14:23.549951	\N	\N	\N	\N	\N	\N
43	scheduled	schedule	comercial → comercial	2026-06-27 23:15:07.68484	\N	\N	\N	\N	\N	\N
44	paired	screen	PROMOÇÃO	2026-06-28 03:35:05.161091	\N	\N	\N	\N	\N	\N
45	uploaded	media	record news	2026-06-30 04:54:56.117187	\N	\N	\N	\N	\N	\N
46	created	playlist	comercial	2026-06-30 04:55:46.383708	\N	\N	\N	\N	\N	\N
47	uploaded	media	louvores	2026-06-30 04:56:32.356767	\N	\N	\N	\N	\N	\N
48	uploaded	media	tv	2026-06-30 04:57:03.967707	\N	\N	\N	\N	\N	\N
49	updated	screen	comercial	2026-06-30 04:57:23.423296	\N	\N	\N	\N	\N	\N
50	deleted	media	Design sem nome (11).png	2026-06-30 05:06:12.524292	\N	\N	\N	\N	\N	\N
51	deleted	media	Design sem nome (9).png	2026-06-30 05:06:14.736336	\N	\N	\N	\N	\N	\N
52	deleted	playlist	comercial	2026-06-30 05:07:09.224872	\N	\N	\N	\N	\N	\N
53	deleted	playlist	comercial	2026-06-30 05:07:11.45902	\N	\N	\N	\N	\N	\N
54	created	playlist	Uniform Skin	2026-06-30 05:09:05.225255	\N	\N	\N	\N	\N	\N
55	deleted	playlist	Uniform Skin	2026-06-30 05:13:37.499096	\N	\N	\N	\N	\N	\N
56	created	playlist	PRECOS GERAL 	2026-06-30 05:13:55.919236	\N	\N	\N	\N	\N	\N
57	deleted	media	Design sem nome (12).png	2026-06-30 05:18:34.926603	\N	\N	\N	\N	\N	\N
58	deleted	media	Design sem nome (11).png	2026-06-30 05:18:38.593973	\N	\N	\N	\N	\N	\N
59	deleted	media	Design sem nome (10).png	2026-06-30 05:18:43.398298	\N	\N	\N	\N	\N	\N
60	uploaded	media	YouTube	2026-06-30 05:19:30.680184	\N	\N	\N	\N	\N	\N
61	uploaded	media	RPSHOW	2026-06-30 05:27:19.233792	\N	\N	\N	\N	\N	\N
62	uploaded	media	RIBEIRAO PRETO	2026-06-30 05:36:02.141907	\N	\N	\N	\N	\N	\N
63	uploaded	media	TLUTO TV	2026-06-30 05:45:05.745947	\N	\N	\N	\N	\N	\N
64	updated	screen	comercial	2026-06-30 05:52:20.179995	\N	\N	\N	\N	\N	\N
65	uploaded	media	YouTube Playlist	2026-06-30 05:53:32.139015	\N	\N	\N	\N	\N	\N
66	uploaded	media	ChatGPT_Image_30_de_jun._de_2026__01_35_34-removebg-preview.png	2026-07-02 03:40:49.420904	4	\N	\N	\N	\N	\N
67	uploaded	media	ChatGPT Image 30 de jun. de 2026, 01_22_26.png	2026-07-02 03:40:49.561049	4	\N	\N	\N	\N	\N
68	uploaded	media	logo-rpshow.png	2026-07-02 03:40:49.560374	4	\N	\N	\N	\N	\N
69	uploaded	media	ChatGPT Image 17 de mai. de 2026, 18_44_38.png	2026-07-02 03:40:49.560302	4	\N	\N	\N	\N	\N
70	uploaded	media	ChatGPT Image 30 de jun. de 2026, 01_35_34.png	2026-07-02 03:40:49.564526	4	\N	\N	\N	\N	\N
71	uploaded	media	logo-rpshow-sem-fundo.png	2026-07-02 03:40:49.564956	4	\N	\N	\N	\N	\N
72	uploaded	media	WhatsApp Video 2026-04-19 at 23.45.21.mp4	2026-07-02 03:40:49.752214	4	\N	\N	\N	\N	\N
73	uploaded	media	Gemini_Generated_Image_5ddppy5ddppy5ddp.png	2026-07-02 03:40:49.76181	4	\N	\N	\N	\N	\N
74	uploaded	media	www.rpshow.com.br.mp4	2026-07-02 03:40:49.766503	4	\N	\N	\N	\N	\N
75	uploaded	media	WhatsApp-Image-2026-02-11-at-18.46.30-2.jpeg	2026-07-02 03:40:49.768373	4	\N	\N	\N	\N	\N
76	uploaded	media	Design sem nome.mp4	2026-07-02 03:40:49.770579	4	\N	\N	\N	\N	\N
77	uploaded	media	WhatsApp Video 2026-03-13 at 17.01.48.mp4	2026-07-02 03:40:49.772529	4	\N	\N	\N	\N	\N
78	uploaded	media	WhatsApp Video 2026-03-16 at 11.52.03.mp4	2026-07-02 03:40:49.943926	4	\N	\N	\N	\N	\N
79	created	playlist	BELOS HOUSE	2026-07-02 03:41:12.905226	4	\N	\N	\N	\N	\N
80	created	playlist	teste.php	2026-07-02 04:00:03.030397	4	\N	\N	\N	\N	\N
81	created	playlist	comercial	2026-07-02 04:07:12.730742	4	\N	\N	\N	\N	\N
82	created	playlist	FAASF	2026-07-02 04:15:45.285808	4	\N	\N	\N	\N	\N
\.


--
-- Data for Name: brightness_schedules; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.brightness_schedules (id, screen_id, start_time, end_time, brightness, days, label, created_at) FROM stdin;
\.


--
-- Data for Name: clients; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.clients (id, name, type, contact_name, contact_phone, address, active, created_at, user_id, cnpj, segment) FROM stdin;
4	RPSHOW	other	BELO	16982208695	RUA APPA 714	t	2026-06-27 21:46:01.126781	\N	\N	\N
\.


--
-- Data for Name: devices; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.devices (id, serial, name, location, notes, status, screen_code, user_id, created_at, approved_at) FROM stdin;
4	MR48YLK7-DIOCW3GW	\N	\N	\N	pending	\N	54826257	2026-07-03 04:03:23.218348	\N
5	2A8F971AC3026FC3	\N	\N	\N	approved	3F669234	54826257	2026-07-03 04:56:53.467295	\N
6	MR4UY8EF-PRNYWCPN	\N	\N	\N	pending	\N	54826257	2026-07-03 11:36:24.486939	\N
7	MR4VPDUC-OTPLXJ4Z	\N	\N	\N	approved	10PQY91K	54826257	2026-07-03 11:57:38.480998	2026-07-03 12:05:54.508994
8	452C4E73BDAEA4C7	\N	\N	\N	approved	69BYP9QT	54826257	2026-07-03 12:06:45.268101	2026-07-03 12:06:45.268101
9	E9B29F0F5697AFEF	\N	\N	\N	pending	\N	\N	2026-07-09 02:36:57.804111	\N
10	21E45CF0CBA7DB33	TESO - 21E45C	\N	\N	approved	\N	54826257	2026-07-11 23:35:40.138277	2026-07-11 23:35:40.138277
\.


--
-- Data for Name: emergency_alerts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.emergency_alerts (id, user_id, message, bg_color, text_color, is_active, expires_at, created_at) FROM stdin;
1	\N	TESTE DE ALERTA	#cc0000	#ffffff	f	\N	2026-06-30 20:00:20.649986
2	1	EVACUAÇÃO GERAL	#cc0000	#ffffff	f	\N	2026-06-30 20:05:44.537762
\.


--
-- Data for Name: locations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.locations (id, user_id, name, abbreviation, address, city, latitude, longitude, image_url, audience, audience_unit, timezone, internal_id, production_type, description, created_at) FROM stdin;
\.


--
-- Data for Name: media; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.media (id, name, type, url, thumbnail_url, duration_seconds, client_id, created_at, user_id, meta_json) FROM stdin;
7	Geração_de_Vídeo_Concluída.mp4	video	/objects/uploads/fc31e8a8-ccc4-47a2-9aac-475da2082638	\N	10	\N	2026-06-27 21:48:11.120773	\N	\N
9	logo-rpshow-sem-fundo.png	image	/objects/uploads/c5b04e78-a165-4446-932b-089a01d8fd7a	\N	10	\N	2026-06-27 22:22:56.485273	\N	\N
10	ChatGPT Image 29 de abr. de 2026, 11_42_43.png	image	/objects/uploads/c873fae8-2535-4b41-a6ac-815221bc1ae1	\N	10	\N	2026-06-27 22:23:11.122624	\N	\N
11	ChatGPT Image 29 de abr. de 2026, 11_52_24.png	image	/objects/uploads/29bd3a69-5c5a-46c1-a74d-e89dc40e4831	\N	10	\N	2026-06-27 22:23:22.230863	\N	\N
15	Design sem nome (10).png	image	/objects/uploads/db15d97d-3297-42c3-9853-3e223603ccb3	\N	10	\N	2026-06-27 23:13:38.498716	\N	\N
16	WhatsApp Video 2026-03-31 at 13.51.19.mp4	video	/objects/uploads/3b984617-04d1-4389-b899-b7170c4ae35c	\N	10	\N	2026-06-27 23:14:03.844634	\N	\N
17	Design sem nome (4).mp4	video	/objects/uploads/031ddf31-5390-4959-8548-91ec8a5f38c8	\N	10	\N	2026-06-27 23:14:03.851751	\N	\N
18	record news	pluto_tv	https://pluto.tv/br/live-tv/6317ba014d4d040007227f72?lang=pt	\N	10	\N	2026-06-30 04:54:56.091619	\N	\N
19	louvores	youtube	https://www.youtube.com/watch?v=X6hso4KiSUY&list=RDX6hso4KiSUY&start_radio=1	\N	0	\N	2026-06-30 04:56:32.353276	\N	\N
20	tv	pluto_tv	https://pluto.tv/br/live-tv/6317ba014d4d040007227f72?lang=pt	\N	0	\N	2026-06-30 04:57:03.931447	\N	\N
21	YouTube	youtube	https://www.youtube.com/watch?v=toxejaH1Cz4&list=RDUm8s7DKMZEM&index=3	\N	0	\N	2026-06-30 05:19:30.645811	\N	\N
22	RPSHOW	text	text://local	\N	15	\N	2026-06-30 05:27:19.19895	\N	{"textContent":"RPSHOW","textSize":68,"textFont":"Impact, 'Arial Black', sans-serif","textColor":"#ffffff","textBold":true,"textItalic":false,"textUppercase":false,"textAlign":"center","textEffect":"rainbow","textShadowColor":"#000000","textStrokeColor":"#000000","textGradientTo":"#ffcc00","textBg":"#000000","textBgOpacity":0}
23	RIBEIRAO PRETO	weather	RIBEIRAO PRETO	\N	20	\N	2026-06-30 05:36:02.105455	\N	\N
24	TLUTO TV	pluto_tv	https://pluto.tv/br/live-tv/6317ba014d4d040007227f72?lang=pt	\N	0	\N	2026-06-30 05:45:05.709234	\N	\N
25	YouTube Playlist	youtube_playlist	https://www.youtube.com/watch?v=3aZL_25Quws&list=RDUm8s7DKMZEM&index=5	\N	0	\N	2026-06-30 05:53:32.133247	\N	\N
26	ChatGPT_Image_30_de_jun._de_2026__01_35_34-removebg-preview.png	image	/objects/uploads/5c7d3136-5a99-457c-8cbb-e8364decd0bb	\N	10	\N	2026-07-02 03:40:49.266757	4	{"width":612,"height":408,"format":"image/png","fileSize":130855}
27	logo-rpshow-sem-fundo.png	image	/objects/uploads/3f5de532-98d5-4133-a1a7-f659d2274272	\N	10	\N	2026-07-02 03:40:49.294989	4	{"width":1093,"height":840,"format":"image/png","fileSize":379566}
28	logo-rpshow.png	image	/objects/uploads/6b461a5f-b537-4cb8-bf1d-96204f5ecde9	\N	10	\N	2026-07-02 03:40:49.298333	4	{"width":1111,"height":832,"format":"image/png","fileSize":719309}
29	ChatGPT Image 17 de mai. de 2026, 18_44_38.png	image	/objects/uploads/30be7de1-1a99-4f04-ba82-cf2dc39540d2	\N	10	\N	2026-07-02 03:40:49.298825	4	{"width":1536,"height":1024,"format":"image/png","fileSize":2284031}
30	ChatGPT Image 30 de jun. de 2026, 01_22_26.png	image	/objects/uploads/135638cc-ae19-4f1d-9f0f-c5d2476688b8	\N	10	\N	2026-07-02 03:40:49.303377	4	{"width":1536,"height":1024,"format":"image/png","fileSize":2393302}
31	ChatGPT Image 30 de jun. de 2026, 01_35_34.png	image	/objects/uploads/15cbecf8-05de-45bd-b4d4-5b246a26ac67	\N	10	\N	2026-07-02 03:40:49.304883	4	{"width":1536,"height":1024,"format":"image/png","fileSize":2078104}
32	WhatsApp Video 2026-04-19 at 23.45.21.mp4	video	/objects/uploads/cfad69bc-73b5-4e7f-89c3-53ce5547c8df	\N	30	\N	2026-07-02 03:40:49.749055	4	{"width":848,"height":480,"duration":30,"format":"video/mp4","fileSize":6781997}
33	Gemini_Generated_Image_5ddppy5ddppy5ddp.png	image	/objects/uploads/53e9f822-2ed7-43ef-91b6-1938f4707f96	\N	10	\N	2026-07-02 03:40:49.758094	4	{"width":2730,"height":1536,"format":"image/png","fileSize":7571256}
34	www.rpshow.com.br.mp4	video	/objects/uploads/c14f7714-2d3b-4666-83d1-158874e9bd35	\N	30	\N	2026-07-02 03:40:49.759525	4	{"width":3840,"height":2160,"duration":30,"format":"video/mp4","fileSize":72358693}
35	WhatsApp-Image-2026-02-11-at-18.46.30-2.jpeg	image	/objects/uploads/26788559-d782-485a-89ce-b809d7b1ea8c	\N	10	\N	2026-07-02 03:40:49.762989	4	{"width":1280,"height":720,"format":"image/jpeg","fileSize":109946}
36	Design sem nome.mp4	video	/objects/uploads/f7ec7227-5dd5-4d42-a75a-552846a3b264	\N	9	\N	2026-07-02 03:40:49.764733	4	{"width":3840,"height":2160,"duration":9,"format":"video/mp4","fileSize":34236594}
37	WhatsApp Video 2026-03-13 at 17.01.48.mp4	video	/objects/uploads/26e483cd-4811-4c3e-89ee-82776a361aaa	\N	12	\N	2026-07-02 03:40:49.767366	4	{"width":848,"height":480,"duration":12,"format":"video/mp4","fileSize":1914115}
38	WhatsApp Video 2026-03-16 at 11.52.03.mp4	video	/objects/uploads/0302dc73-025d-4047-9568-ab5d6f367b9d	\N	7	\N	2026-07-02 03:40:49.940906	4	{"width":1024,"height":576,"duration":7,"format":"video/mp4","fileSize":1493178}
\.


--
-- Data for Name: media_plays; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.media_plays (id, screen_id, screen_code, screen_name, media_id, media_name, media_type, played_at, duration_seconds, user_id, campaign_group_id, client_name, playlist_id) FROM stdin;
\.


--
-- Data for Name: operators; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.operators (id, username, password_hash, name, role, created_at, onboarding_done, segment, job_role, screen_count, totp_secret, totp_enabled, email, phone, subscription_status, trial_ends_at, trial_days, monthly_amount, price_per_screen, blocked) FROM stdin;
1	admin	$2b$12$E3RQ0bZuPk70eYPYPiwP2.Lt4y75Ap7EspLOHUHBJph7M492p9QJe	Administrador	admin	2026-06-28 21:54:26.321653	t	Posto de Combustível	proprietario	2-5	JDKNOKDVECYYLCURESP57JN7DX7P4UQH	f	\N	\N	active	\N	30	80.00	50.00	f
\.


--
-- Data for Name: password_reset_tokens; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.password_reset_tokens (id, operator_id, token, created_at, expires_at, used) FROM stdin;
1	1	6bf185ae6880f48e07d3cad8256794562756fb9bfe6e8c871b186860216213a8	2026-07-08 13:30:46.008789	2026-07-08 14:30:46.007	t
\.


--
-- Data for Name: playlist_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.playlist_items (id, playlist_id, media_id, "position", duration_seconds, object_fit) FROM stdin;
45	9	17	0	10	contain
48	9	15	1	10	contain
49	9	15	2	10	contain
50	10	38	0	7	contain
51	10	34	1	30	contain
\.


--
-- Data for Name: playlists; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.playlists (id, name, client_id, created_at, user_id, layout_json, transition_effect, resolution_width, resolution_height, published_snapshot_json, published_at) FROM stdin;
9	PRECOS GERAL 	\N	2026-06-30 05:13:55.915667	\N	\N	fade	1920	1080	\N	\N
10	BELOS HOUSE	\N	2026-07-02 03:41:12.900142	4	\N	fade	1920	1080	\N	\N
11	teste.php	\N	2026-07-02 04:00:03.018395	4	\N	fade	1920	1080	\N	\N
12	comercial	\N	2026-07-02 04:07:12.699721	4	\N	fade	1920	1080	\N	\N
13	FAASF	\N	2026-07-02 04:15:45.237683	4	\N	fade	1920	1080	\N	\N
\.


--
-- Data for Name: schedules; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.schedules (id, screen_id, playlist_id, start_time, end_time, days_of_week, active, created_at, name, start_at, end_at, client_name, campaign_group_id, end_notified_at) FROM stdin;
\.


--
-- Data for Name: screen_connections; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.screen_connections (id, screen_id, connected_at, disconnected_at) FROM stdin;
\.


--
-- Data for Name: screen_groups; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.screen_groups (id, user_id, name, color, created_at) FROM stdin;
\.


--
-- Data for Name: screens; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.screens (id, name, client_id, code, location, status, last_seen, created_at, user_id, default_playlist_id, resolution, tags, last_screenshot, power_on_time, power_off_time, power_schedule_json, timezone, group_id, blocked, panel_width, panel_height, price, online_since, panel_rotation, target_brightness) FROM stdin;
8	comercial	4	76EC9776		online	2026-06-29 05:48:39.501	2026-06-27 23:13:21.787496	54826257	9	\N	\N	\N	\N	\N	\N	America/Sao_Paulo	\N	f	\N	\N	\N	\N	0	\N
9	PROMOÇÃO	\N	PSJT0001	PAINEL PSJT AV CAFE	online	2026-06-30 20:00:30.638	2026-06-28 03:27:51.831087	54826257	\N	\N	\N	\N	\N	\N	\N	America/Sao_Paulo	\N	f	\N	\N	\N	\N	0	\N
10	Tela - 026FC3	\N	3F669234	\N	unknown	\N	2026-07-03 04:57:40.984304	54826257	\N	\N	\N	\N	\N	\N	\N	America/Sao_Paulo	\N	f	\N	\N	\N	\N	0	\N
12	Tela - AEA4C7	\N	69BYP9QT	\N	unknown	\N	2026-07-03 12:06:50.162799	54826257	\N	\N	\N	\N	\N	\N	\N	America/Sao_Paulo	\N	f	\N	\N	\N	\N	0	\N
11	Tela - TB1	\N	10PQY91K	\N	online	2026-07-06 12:09:53.902	2026-07-03 12:05:59.299897	54826257	\N	412x870	\N	\N	\N	\N	\N	America/Sao_Paulo	\N	f	168	168	\N	\N	0	\N
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sessions (sid, sess, expire) FROM stdin;
a5a3ea8be0b537ed283529eb6d57c07bc5f8c7cc4e842fe4fa3aaf2886e87045	{"user": {"id": "54826257", "email": "fbelo.rp@gmail.com", "lastName": "Rp", "firstName": "Fbelo", "pairingCode": "7FAN8T", "profileImageUrl": "https://lh3.googleusercontent.com/a/ACg8ocI0Bh6Y95g7vjjUcSshr8l_UZ_vnx4_w2VxPt-4ZZK14XsMvRXx=s96-c"}, "expires_at": 1782670537, "access_token": "KB2P9VMVlQBt1f5J8woEKGgmxyG6PcoJeh5651NdqdN", "refresh_token": "x6DClL1SJT6sCubOSclXm2PS3EXds0rtAzGRiZkTPbk"}	2026-07-05 17:15:38.348
42685efa36886004702a1d38f993039f417c96847b92951d957c5271cb4bc8dd	{"user": {"id": "1", "name": "Administrador", "role": "admin", "username": "admin"}}	2026-07-05 21:54:31.134
0359ed65143cb775c1a11f417a5b71e2a8d4d7d360f7d070d2d0a43a16f05424	{"user": {"id": "1", "name": "Administrador", "role": "admin", "username": "admin"}}	2026-07-05 22:40:09.764
f9ac3504b725fe62b0aa467f6b874e2ed3a2495ced57f708f1fae271cf01d8e2	{"user": {"id": "1", "name": "Administrador", "role": "admin", "username": "admin"}}	2026-07-05 22:48:22.142
76f203cdd80fbb67542869f29d3c1aa51e72f95a94c3d4f4054291e941d705a7	{"user": {"id": "1", "name": "Administrador", "role": "admin", "username": "admin"}}	2027-06-29 05:06:32.284
49f3795aa09bc7ff77fa4759d33bab14095b9b7008ea720da1f398e340576bad	{"user": {"id": "1", "name": "Administrador", "role": "admin", "username": "admin"}}	2027-06-29 05:48:32.503
b256de6a8fc95330880324e34b7f5f6c0c9feec944aec687a748deb5abf2c482	{"user": {"id": "1", "name": "Administrador", "role": "admin", "username": "admin"}}	2027-06-30 01:56:26.434
6ce5ddd4b6e71906d222b425a938cb4886b62aa969219c544201e12ae1c4a20f	{"user": {"id": "1", "name": "Administrador", "role": "admin", "username": "admin"}}	2027-06-30 02:07:31.182
bcc9ec9dc9c35dd67d53b085745042e5f266e6c7ba6c0dc6412fcfc783c72202	{"user": {"id": "1", "name": "Administrador", "role": "admin", "username": "admin"}}	2027-06-30 02:08:34.876
ea09a5e847b0f025df6ddcd211efbc5e108c7f76d3e54b272fde251c8463d936	{"user": {"id": "1", "name": "Administrador", "role": "admin", "username": "admin"}}	2027-06-30 02:08:43.173
5df043c012994e9b6f46b7c27c804b81c055f807904e16b1582b8b11d8c5c8cd	{"user": {"id": "1", "name": "Administrador", "role": "admin", "username": "admin"}}	2027-06-30 02:09:08.138
cceaa3f6ef53286712e785f8962d80de248266f4af954e8d0ce58e1ccea84865	{"user": {"id": "1", "name": "Administrador", "role": "admin", "username": "admin"}}	2027-06-30 05:45:46.148
f0711061ee8372293fc70b5731e0abbaef394e1d8735918d97c7be52f70248d6	{"user": {"id": "1", "name": "Administrador", "role": "admin", "username": "admin"}}	2027-06-30 05:48:44.304
4aad27958b038ce6b164e3d383c95f28362aadb841c034ef58aa84af69bb941d	{"user": {"id": "1", "name": "Administrador", "role": "admin", "username": "admin"}}	2027-06-30 05:54:03.987
3cf8781a1165ae6addbe987f580ca59b0908b11e40f8e11083a5b0fda0b02e0a	{"user": {"id": "1", "name": "Administrador", "role": "admin", "username": "admin"}}	2027-06-30 05:58:14.686
733cba1c7861410236c680ed17e9a28058b1f0a2bbfcbce3c389c40335df5e72	{"user": {"id": "1", "name": "Administrador", "role": "admin", "username": "admin"}}	2027-06-30 05:58:15.086
7fb5890cda66c8c5be53d65e3c43e446c1cfebc5020037d908f3a6352234a460	{"user": {"id": "1", "name": "Administrador", "role": "admin", "username": "admin"}}	2027-06-30 06:01:35.814
1c34de8087fea35ebb3bd51c7be342b3233c8de000d54750402b536c9b89a65c	{"user": {"id": "1", "name": "Administrador", "role": "admin", "username": "admin"}}	2027-06-30 20:00:09.377
45c598b714160e25cbb0ed36e2de470a62cfc634b5a92a7ff29876eebba18820	{"user": {"id": "1", "name": "Administrador", "role": "admin", "username": "admin"}}	2027-06-30 20:05:44.289
af8c8e5abc88c5628aa059f3c2baddbedf6b770c374b52338526152f9e20869d	{"user": {"id": "1", "name": "Administrador", "role": "admin", "username": "admin"}}	2027-07-01 13:42:17.775
553973fefceac13b65a708511bbc09b4bab0811ac776f4a57e5c985be317e19b	{"user": {"id": "1", "name": "Administrador", "role": "admin", "username": "admin"}}	2027-07-01 22:12:15.91
13abb8d58d41729e21fd8cc768c9ac4be790cfeed0ff81d58e84a3e7aee54bf0	{"user": {"id": "1", "name": "Administrador", "role": "admin", "username": "admin"}}	2027-07-01 23:33:57.577
9dc0c719c24e4379529be1ef9ab048987538ec471a23fed9056cebabe0538ccf	{"user": {"id": "1", "name": "Administrador", "role": "admin", "username": "admin"}}	2027-07-02 02:32:13.737
ecb80d93171f712c3452630c31d90445bea823b3c292a52eee6911c9cea0a404	{"user": {"id": "4", "name": "belo", "role": "operator", "username": "belo"}}	2027-07-02 03:26:26.1
532c4539ece4f5fafbf8bd3ab85a1e8b8650b15838bb3420a674e7215c6f4a94	{"user": {"id": "1", "name": "Administrador", "role": "admin", "username": "admin"}}	2027-07-02 16:11:54.558
c8181176f7951ccb963e18c41a555551e2d0379534b3af85b8c93508cb772ead	{"user": {"id": "5", "name": "claudio", "role": "operator", "username": "claudio"}}	2027-07-02 17:42:32.598
e5db2a3280c8b930bad6300db90938f3b6c4870da54c6131988e57f333792b2c	{"user": {"id": "5", "name": "claudio", "role": "operator", "username": "claudio"}}	2027-07-02 22:37:44.434
8a0db35ba1272e86dbb518aa2925c3f27c744d964a0dd81609bd7b5d5e30e565	{"user": {"id": "1", "name": "Administrador", "role": "admin", "username": "admin"}}	2027-07-03 04:00:12.257
e88f370f7a8a849b08d0211892db717541ecd4b2861bc74c098676e296faeb2a	{"user": {"id": "1", "name": "Administrador", "role": "admin", "username": "admin"}}	2027-07-08 13:31:09.227
39f33a1d5aef4e49b9d6976c57cedd5ac1cf87902bd867f070f866149991f0cb	{"user": {"id": "1", "name": "Administrador", "role": "admin", "username": "admin"}}	2027-07-08 13:47:04.62
f04c5625293773ab322f0977b641aac45e14767d4855f9acf7dfc260a98a4b89	{"user": {"id": "1", "name": "Administrador", "role": "admin", "username": "admin"}}	2027-07-08 13:48:22.559
\.


--
-- Data for Name: subscription_payments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.subscription_payments (id, operator_id, reference_month, status, amount, notes, paid_at, due_date, created_at, screen_id, payment_type) FROM stdin;
\.


--
-- Data for Name: trusted_devices; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.trusted_devices (id, operator_id, token, device_name, created_at, expires_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, email, first_name, last_name, profile_image_url, created_at, updated_at, pairing_code) FROM stdin;
54826257	fbelo.rp@gmail.com	Fbelo	Rp	https://lh3.googleusercontent.com/a/ACg8ocI0Bh6Y95g7vjjUcSshr8l_UZ_vnx4_w2VxPt-4ZZK14XsMvRXx=s96-c	2026-06-28 17:15:38.077676+00	2026-06-28 17:15:38.077676+00	7FAN8T
\.


--
-- Name: activity_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.activity_id_seq', 82, true);


--
-- Name: brightness_schedules_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.brightness_schedules_id_seq', 1, false);


--
-- Name: clients_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.clients_id_seq', 4, true);


--
-- Name: devices_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.devices_id_seq', 10, true);


--
-- Name: emergency_alerts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.emergency_alerts_id_seq', 2, true);


--
-- Name: locations_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.locations_id_seq', 1, false);


--
-- Name: media_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.media_id_seq', 38, true);


--
-- Name: media_plays_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.media_plays_id_seq', 1, false);


--
-- Name: operators_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.operators_id_seq', 5, true);


--
-- Name: password_reset_tokens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.password_reset_tokens_id_seq', 1, true);


--
-- Name: playlist_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.playlist_items_id_seq', 51, true);


--
-- Name: playlists_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.playlists_id_seq', 13, true);


--
-- Name: schedules_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.schedules_id_seq', 9, true);


--
-- Name: screen_connections_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.screen_connections_id_seq', 1, false);


--
-- Name: screen_groups_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.screen_groups_id_seq', 2, true);


--
-- Name: screens_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.screens_id_seq', 14, true);


--
-- Name: subscription_payments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.subscription_payments_id_seq', 2, true);


--
-- Name: trusted_devices_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.trusted_devices_id_seq', 1, false);


--
-- Name: activity activity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.activity
    ADD CONSTRAINT activity_pkey PRIMARY KEY (id);


--
-- Name: brightness_schedules brightness_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brightness_schedules
    ADD CONSTRAINT brightness_schedules_pkey PRIMARY KEY (id);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: devices devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_pkey PRIMARY KEY (id);


--
-- Name: devices devices_serial_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_serial_unique UNIQUE (serial);


--
-- Name: emergency_alerts emergency_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.emergency_alerts
    ADD CONSTRAINT emergency_alerts_pkey PRIMARY KEY (id);


--
-- Name: locations locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_pkey PRIMARY KEY (id);


--
-- Name: media media_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media
    ADD CONSTRAINT media_pkey PRIMARY KEY (id);


--
-- Name: media_plays media_plays_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.media_plays
    ADD CONSTRAINT media_plays_pkey PRIMARY KEY (id);


--
-- Name: operators operators_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operators
    ADD CONSTRAINT operators_pkey PRIMARY KEY (id);


--
-- Name: operators operators_username_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.operators
    ADD CONSTRAINT operators_username_unique UNIQUE (username);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_token_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_token_unique UNIQUE (token);


--
-- Name: playlist_items playlist_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.playlist_items
    ADD CONSTRAINT playlist_items_pkey PRIMARY KEY (id);


--
-- Name: playlists playlists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.playlists
    ADD CONSTRAINT playlists_pkey PRIMARY KEY (id);


--
-- Name: schedules schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_pkey PRIMARY KEY (id);


--
-- Name: screen_connections screen_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.screen_connections
    ADD CONSTRAINT screen_connections_pkey PRIMARY KEY (id);


--
-- Name: screen_groups screen_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.screen_groups
    ADD CONSTRAINT screen_groups_pkey PRIMARY KEY (id);


--
-- Name: screens screens_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.screens
    ADD CONSTRAINT screens_code_unique UNIQUE (code);


--
-- Name: screens screens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.screens
    ADD CONSTRAINT screens_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (sid);


--
-- Name: subscription_payments subscription_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_payments
    ADD CONSTRAINT subscription_payments_pkey PRIMARY KEY (id);


--
-- Name: trusted_devices trusted_devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trusted_devices
    ADD CONSTRAINT trusted_devices_pkey PRIMARY KEY (id);


--
-- Name: trusted_devices trusted_devices_token_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trusted_devices
    ADD CONSTRAINT trusted_devices_token_unique UNIQUE (token);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pairing_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pairing_code_unique UNIQUE (pairing_code);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_session_expire" ON public.sessions USING btree (expire);


--
-- Name: brightness_schedules brightness_schedules_screen_id_screens_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.brightness_schedules
    ADD CONSTRAINT brightness_schedules_screen_id_screens_id_fk FOREIGN KEY (screen_id) REFERENCES public.screens(id) ON DELETE CASCADE;


--
-- Name: password_reset_tokens password_reset_tokens_operator_id_operators_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_operator_id_operators_id_fk FOREIGN KEY (operator_id) REFERENCES public.operators(id) ON DELETE CASCADE;


--
-- Name: playlist_items playlist_items_media_id_media_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.playlist_items
    ADD CONSTRAINT playlist_items_media_id_media_id_fk FOREIGN KEY (media_id) REFERENCES public.media(id) ON DELETE CASCADE;


--
-- Name: playlist_items playlist_items_playlist_id_playlists_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.playlist_items
    ADD CONSTRAINT playlist_items_playlist_id_playlists_id_fk FOREIGN KEY (playlist_id) REFERENCES public.playlists(id) ON DELETE CASCADE;


--
-- Name: schedules schedules_playlist_id_playlists_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_playlist_id_playlists_id_fk FOREIGN KEY (playlist_id) REFERENCES public.playlists(id) ON DELETE CASCADE;


--
-- Name: schedules schedules_screen_id_screens_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_screen_id_screens_id_fk FOREIGN KEY (screen_id) REFERENCES public.screens(id) ON DELETE CASCADE;


--
-- Name: screen_connections screen_connections_screen_id_screens_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.screen_connections
    ADD CONSTRAINT screen_connections_screen_id_screens_id_fk FOREIGN KEY (screen_id) REFERENCES public.screens(id) ON DELETE CASCADE;


--
-- Name: screens screens_default_playlist_id_playlists_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.screens
    ADD CONSTRAINT screens_default_playlist_id_playlists_id_fk FOREIGN KEY (default_playlist_id) REFERENCES public.playlists(id) ON DELETE SET NULL;


--
-- Name: screens screens_group_id_screen_groups_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.screens
    ADD CONSTRAINT screens_group_id_screen_groups_id_fk FOREIGN KEY (group_id) REFERENCES public.screen_groups(id) ON DELETE SET NULL;


--
-- Name: subscription_payments subscription_payments_screen_id_screens_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscription_payments
    ADD CONSTRAINT subscription_payments_screen_id_screens_id_fk FOREIGN KEY (screen_id) REFERENCES public.screens(id) ON DELETE SET NULL;


--
-- Name: trusted_devices trusted_devices_operator_id_operators_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trusted_devices
    ADD CONSTRAINT trusted_devices_operator_id_operators_id_fk FOREIGN KEY (operator_id) REFERENCES public.operators(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict trykheeT1KLwzQPYwToMAe5dQR2izOZUzekNaDhNI6OqUHP42UEKbXR1znfaqpS

