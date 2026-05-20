--
-- PostgreSQL database dump
--

\restrict xVrnbqLtp2OupGPcYORgTldjrJfxzHkvuiz6u2jcLKfgJEyhBv46Zxmrd6JUys7

-- Dumped from database version 16.13
-- Dumped by pg_dump version 16.13

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

--
-- Name: tenant_template; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA tenant_template;


--
-- Name: AssignmentStatus; Type: TYPE; Schema: tenant_template; Owner: -
--

CREATE TYPE tenant_template."AssignmentStatus" AS ENUM (
    'Active',
    'Inactive'
);


--
-- Name: FileLockType; Type: TYPE; Schema: tenant_template; Owner: -
--

CREATE TYPE tenant_template."FileLockType" AS ENUM (
    'lock',
    'delete'
);


--
-- Name: FlowDesignAttributeKind; Type: TYPE; Schema: tenant_template; Owner: -
--

CREATE TYPE tenant_template."FlowDesignAttributeKind" AS ENUM (
    'Object',
    'File',
    'Folder',
    'Equipment'
);


--
-- Name: MachineDataRegistration; Type: TYPE; Schema: tenant_template; Owner: -
--

CREATE TYPE tenant_template."MachineDataRegistration" AS ENUM (
    'no',
    'yes',
    'pre'
);


--
-- Name: MachineFileType; Type: TYPE; Schema: tenant_template; Owner: -
--

CREATE TYPE tenant_template."MachineFileType" AS ENUM (
    'Image',
    'Excel',
    'PDF',
    'Video'
);


--
-- Name: MachineRunningStatus; Type: TYPE; Schema: tenant_template; Owner: -
--

CREATE TYPE tenant_template."MachineRunningStatus" AS ENUM (
    'on',
    'off'
);


--
-- Name: MachineSignalType; Type: TYPE; Schema: tenant_template; Owner: -
--

CREATE TYPE tenant_template."MachineSignalType" AS ENUM (
    'on',
    'off',
    'warning'
);


--
-- Name: OrderSelection; Type: TYPE; Schema: tenant_template; Owner: -
--

CREATE TYPE tenant_template."OrderSelection" AS ENUM (
    'free_text',
    'list'
);


--
-- Name: StopCategoryKind; Type: TYPE; Schema: tenant_template; Owner: -
--

CREATE TYPE tenant_template."StopCategoryKind" AS ENUM (
    'Performance',
    'Availability',
    'Quality',
    'Other'
);


--
-- Name: StopDataKind; Type: TYPE; Schema: tenant_template; Owner: -
--

CREATE TYPE tenant_template."StopDataKind" AS ENUM (
    'reg',
    'pre'
);


--
-- Name: TypeEntity; Type: TYPE; Schema: tenant_template; Owner: -
--

CREATE TYPE tenant_template."TypeEntity" AS ENUM (
    'Equipment',
    'Content',
    'StopReason',
    'ScrapReason',
    'Part',
    'Order'
);


--
-- Name: TypeKind; Type: TYPE; Schema: tenant_template; Owner: -
--

CREATE TYPE tenant_template."TypeKind" AS ENUM (
    'Performance',
    'Availability',
    'Quality',
    'Other',
    'NotApplicable'
);


--
-- Name: ValueAddedType; Type: TYPE; Schema: tenant_template; Owner: -
--

CREATE TYPE tenant_template."ValueAddedType" AS ENUM (
    'currency',
    'percentage'
);


--
-- Name: YN; Type: TYPE; Schema: tenant_template; Owner: -
--

CREATE TYPE tenant_template."YN" AS ENUM (
    'Y',
    'N'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: dashboard_widgets; Type: TABLE; Schema: tenant_template; Owner: -
--

CREATE TABLE tenant_template.dashboard_widgets (
    id integer NOT NULL,
    board_id integer NOT NULL,
    title character varying(255) NOT NULL,
    img_path character varying(255) NOT NULL,
    settings character varying(1024) DEFAULT ''::character varying NOT NULL,
    created_by integer NOT NULL,
    created_by_email character varying(255) DEFAULT ''::character varying NOT NULL,
    created_by_name character varying(255) DEFAULT ''::character varying NOT NULL,
    legacy_id bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp with time zone
);


--
-- Name: dashboard_widgets_id_seq; Type: SEQUENCE; Schema: tenant_template; Owner: -
--

CREATE SEQUENCE tenant_template.dashboard_widgets_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dashboard_widgets_id_seq; Type: SEQUENCE OWNED BY; Schema: tenant_template; Owner: -
--

ALTER SEQUENCE tenant_template.dashboard_widgets_id_seq OWNED BY tenant_template.dashboard_widgets.id;


--
-- Name: dashboards; Type: TABLE; Schema: tenant_template; Owner: -
--

CREATE TABLE tenant_template.dashboards (
    id integer NOT NULL,
    status smallint DEFAULT 1 NOT NULL,
    name character varying(255) NOT NULL,
    slot_data text,
    total_slots smallint DEFAULT 6 NOT NULL,
    created_by integer NOT NULL,
    created_by_email character varying(255) DEFAULT ''::character varying NOT NULL,
    created_by_name character varying(255) DEFAULT ''::character varying NOT NULL,
    legacy_id bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: dashboards_id_seq; Type: SEQUENCE; Schema: tenant_template; Owner: -
--

CREATE SEQUENCE tenant_template.dashboards_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dashboards_id_seq; Type: SEQUENCE OWNED BY; Schema: tenant_template; Owner: -
--

ALTER SEQUENCE tenant_template.dashboards_id_seq OWNED BY tenant_template.dashboards.id;


--
-- Name: equipment; Type: TABLE; Schema: tenant_template; Owner: -
--

CREATE TABLE tenant_template.equipment (
    id integer NOT NULL,
    company_id integer DEFAULT 0 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    parent_id integer DEFAULT 0 NOT NULL,
    type_id integer DEFAULT 0 NOT NULL,
    name character varying(255),
    description text,
    icon character varying(255) DEFAULT 'noimage.jpg'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    legacy_id bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: equipment_assign; Type: TABLE; Schema: tenant_template; Owner: -
--

CREATE TABLE tenant_template.equipment_assign (
    id integer NOT NULL,
    equipment_id integer DEFAULT 0 NOT NULL,
    user_id integer DEFAULT 0 NOT NULL,
    user_email character varying(255) DEFAULT ''::character varying NOT NULL,
    user_name character varying(255) DEFAULT ''::character varying NOT NULL,
    status tenant_template."AssignmentStatus" DEFAULT 'Active'::tenant_template."AssignmentStatus" NOT NULL,
    legacy_id bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: equipment_assign_id_seq; Type: SEQUENCE; Schema: tenant_template; Owner: -
--

CREATE SEQUENCE tenant_template.equipment_assign_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: equipment_assign_id_seq; Type: SEQUENCE OWNED BY; Schema: tenant_template; Owner: -
--

ALTER SEQUENCE tenant_template.equipment_assign_id_seq OWNED BY tenant_template.equipment_assign.id;


--
-- Name: equipment_id_seq; Type: SEQUENCE; Schema: tenant_template; Owner: -
--

CREATE SEQUENCE tenant_template.equipment_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: equipment_id_seq; Type: SEQUENCE OWNED BY; Schema: tenant_template; Owner: -
--

ALTER SEQUENCE tenant_template.equipment_id_seq OWNED BY tenant_template.equipment.id;


--
-- Name: equipment_orders; Type: TABLE; Schema: tenant_template; Owner: -
--

CREATE TABLE tenant_template.equipment_orders (
    id integer NOT NULL,
    equipment_id integer DEFAULT 0 NOT NULL,
    order_type_id integer DEFAULT 0 NOT NULL,
    status smallint DEFAULT 1 NOT NULL,
    legacy_id bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp with time zone
);


--
-- Name: equipment_orders_id_seq; Type: SEQUENCE; Schema: tenant_template; Owner: -
--

CREATE SEQUENCE tenant_template.equipment_orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: equipment_orders_id_seq; Type: SEQUENCE OWNED BY; Schema: tenant_template; Owner: -
--

ALTER SEQUENCE tenant_template.equipment_orders_id_seq OWNED BY tenant_template.equipment_orders.id;


--
-- Name: equipment_parts; Type: TABLE; Schema: tenant_template; Owner: -
--

CREATE TABLE tenant_template.equipment_parts (
    id integer NOT NULL,
    equipment_id integer DEFAULT 0 NOT NULL,
    part_type_id integer DEFAULT 0 NOT NULL,
    status smallint DEFAULT 1 NOT NULL,
    legacy_id bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: equipment_parts_id_seq; Type: SEQUENCE; Schema: tenant_template; Owner: -
--

CREATE SEQUENCE tenant_template.equipment_parts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: equipment_parts_id_seq; Type: SEQUENCE OWNED BY; Schema: tenant_template; Owner: -
--

ALTER SEQUENCE tenant_template.equipment_parts_id_seq OWNED BY tenant_template.equipment_parts.id;


--
-- Name: equipment_properties; Type: TABLE; Schema: tenant_template; Owner: -
--

CREATE TABLE tenant_template.equipment_properties (
    id integer NOT NULL,
    equip_id integer NOT NULL,
    type_id integer NOT NULL,
    cycle_time character varying(512) DEFAULT ''::character varying NOT NULL,
    cost_per_hour integer DEFAULT 0 NOT NULL,
    currency character varying(10) DEFAULT ''::character varying NOT NULL,
    operator integer DEFAULT 0 NOT NULL,
    salary_group_id integer NOT NULL,
    value_added_type tenant_template."ValueAddedType" DEFAULT 'currency'::tenant_template."ValueAddedType" NOT NULL,
    value_added_val character varying(10) NOT NULL,
    order_selection tenant_template."OrderSelection" DEFAULT 'free_text'::tenant_template."OrderSelection" NOT NULL,
    legacy_id bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: equipment_properties_id_seq; Type: SEQUENCE; Schema: tenant_template; Owner: -
--

CREATE SEQUENCE tenant_template.equipment_properties_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: equipment_properties_id_seq; Type: SEQUENCE OWNED BY; Schema: tenant_template; Owner: -
--

ALTER SEQUENCE tenant_template.equipment_properties_id_seq OWNED BY tenant_template.equipment_properties.id;


--
-- Name: equipment_scrap_reasons; Type: TABLE; Schema: tenant_template; Owner: -
--

CREATE TABLE tenant_template.equipment_scrap_reasons (
    id integer NOT NULL,
    equipment_id integer DEFAULT 0 NOT NULL,
    reason_type_id integer DEFAULT 0 NOT NULL,
    status smallint DEFAULT 1 NOT NULL,
    legacy_id bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: equipment_scrap_reasons_id_seq; Type: SEQUENCE; Schema: tenant_template; Owner: -
--

CREATE SEQUENCE tenant_template.equipment_scrap_reasons_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: equipment_scrap_reasons_id_seq; Type: SEQUENCE OWNED BY; Schema: tenant_template; Owner: -
--

ALTER SEQUENCE tenant_template.equipment_scrap_reasons_id_seq OWNED BY tenant_template.equipment_scrap_reasons.id;


--
-- Name: equipment_shift_schedule; Type: TABLE; Schema: tenant_template; Owner: -
--

CREATE TABLE tenant_template.equipment_shift_schedule (
    id integer NOT NULL,
    equipment_id integer NOT NULL,
    schedule_id integer NOT NULL,
    also_assign_import boolean DEFAULT false NOT NULL,
    legacy_id bigint
);


--
-- Name: equipment_shift_schedule_id_seq; Type: SEQUENCE; Schema: tenant_template; Owner: -
--

CREATE SEQUENCE tenant_template.equipment_shift_schedule_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: equipment_shift_schedule_id_seq; Type: SEQUENCE OWNED BY; Schema: tenant_template; Owner: -
--

ALTER SEQUENCE tenant_template.equipment_shift_schedule_id_seq OWNED BY tenant_template.equipment_shift_schedule.id;


--
-- Name: equipment_stop_reasons; Type: TABLE; Schema: tenant_template; Owner: -
--

CREATE TABLE tenant_template.equipment_stop_reasons (
    id integer NOT NULL,
    equipment_id integer DEFAULT 0 NOT NULL,
    reason_type_id integer DEFAULT 0 NOT NULL,
    status smallint DEFAULT 1 NOT NULL,
    legacy_id bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: equipment_stop_reasons_id_seq; Type: SEQUENCE; Schema: tenant_template; Owner: -
--

CREATE SEQUENCE tenant_template.equipment_stop_reasons_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: equipment_stop_reasons_id_seq; Type: SEQUENCE OWNED BY; Schema: tenant_template; Owner: -
--

ALTER SEQUENCE tenant_template.equipment_stop_reasons_id_seq OWNED BY tenant_template.equipment_stop_reasons.id;


--
-- Name: flow_design_attributes; Type: TABLE; Schema: tenant_template; Owner: -
--

CREATE TABLE tenant_template.flow_design_attributes (
    id integer NOT NULL,
    flow_design_id integer NOT NULL,
    relation_id integer NOT NULL,
    type tenant_template."FlowDesignAttributeKind" NOT NULL,
    "left" integer DEFAULT 0 NOT NULL,
    "right" integer DEFAULT 0 NOT NULL,
    legacy_id bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: flow_design_attributes_id_seq; Type: SEQUENCE; Schema: tenant_template; Owner: -
--

CREATE SEQUENCE tenant_template.flow_design_attributes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: flow_design_attributes_id_seq; Type: SEQUENCE OWNED BY; Schema: tenant_template; Owner: -
--

ALTER SEQUENCE tenant_template.flow_design_attributes_id_seq OWNED BY tenant_template.flow_design_attributes.id;


--
-- Name: flow_designs; Type: TABLE; Schema: tenant_template; Owner: -
--

CREATE TABLE tenant_template.flow_designs (
    id integer NOT NULL,
    name character varying(250) NOT NULL,
    flow_data text,
    status smallint DEFAULT 1 NOT NULL,
    legacy_id bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: flow_designs_id_seq; Type: SEQUENCE; Schema: tenant_template; Owner: -
--

CREATE SEQUENCE tenant_template.flow_designs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: flow_designs_id_seq; Type: SEQUENCE OWNED BY; Schema: tenant_template; Owner: -
--

ALTER SEQUENCE tenant_template.flow_designs_id_seq OWNED BY tenant_template.flow_designs.id;


--
-- Name: folders; Type: TABLE; Schema: tenant_template; Owner: -
--

CREATE TABLE tenant_template.folders (
    id integer NOT NULL,
    equipment_id integer DEFAULT 0 NOT NULL,
    name character varying(255) NOT NULL,
    folder_type integer NOT NULL,
    status smallint DEFAULT 1 NOT NULL,
    legacy_id bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp with time zone
);


--
-- Name: folders_id_seq; Type: SEQUENCE; Schema: tenant_template; Owner: -
--

CREATE SEQUENCE tenant_template.folders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: folders_id_seq; Type: SEQUENCE OWNED BY; Schema: tenant_template; Owner: -
--

ALTER SEQUENCE tenant_template.folders_id_seq OWNED BY tenant_template.folders.id;


--
-- Name: machine_data; Type: TABLE; Schema: tenant_template; Owner: -
--

CREATE TABLE tenant_template.machine_data (
    id integer NOT NULL,
    machine_id integer NOT NULL,
    start_time timestamp with time zone,
    end_time timestamp with time zone,
    is_registered tenant_template."MachineDataRegistration" DEFAULT 'no'::tenant_template."MachineDataRegistration" NOT NULL,
    is_valid_data boolean DEFAULT true NOT NULL,
    production_time character varying(10),
    legacy_id bigint
);


--
-- Name: machine_data_id_seq; Type: SEQUENCE; Schema: tenant_template; Owner: -
--

CREATE SEQUENCE tenant_template.machine_data_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: machine_data_id_seq; Type: SEQUENCE OWNED BY; Schema: tenant_template; Owner: -
--

ALTER SEQUENCE tenant_template.machine_data_id_seq OWNED BY tenant_template.machine_data.id;


--
-- Name: machine_document_files; Type: TABLE; Schema: tenant_template; Owner: -
--

CREATE TABLE tenant_template.machine_document_files (
    id integer NOT NULL,
    machine_id integer DEFAULT 0 NOT NULL,
    filename character varying(255) DEFAULT 'noimage.png'::character varying,
    filetype tenant_template."MachineFileType" DEFAULT 'Image'::tenant_template."MachineFileType",
    is_main boolean DEFAULT false NOT NULL,
    is_locked boolean DEFAULT false NOT NULL,
    uploaded_at timestamp with time zone,
    downloaded_at timestamp with time zone,
    is_active boolean DEFAULT true NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    user_id integer DEFAULT 0 NOT NULL,
    uploaded_by_email character varying(255) DEFAULT ''::character varying NOT NULL,
    uploaded_by_name character varying(255) DEFAULT ''::character varying NOT NULL,
    locked_by_user_id integer DEFAULT 0 NOT NULL,
    locked_by_email character varying(255) DEFAULT ''::character varying NOT NULL,
    locked_by_name character varying(255) DEFAULT ''::character varying NOT NULL,
    legacy_id bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: machine_document_files_id_seq; Type: SEQUENCE; Schema: tenant_template; Owner: -
--

CREATE SEQUENCE tenant_template.machine_document_files_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: machine_document_files_id_seq; Type: SEQUENCE OWNED BY; Schema: tenant_template; Owner: -
--

ALTER SEQUENCE tenant_template.machine_document_files_id_seq OWNED BY tenant_template.machine_document_files.id;


--
-- Name: machine_documents; Type: TABLE; Schema: tenant_template; Owner: -
--

CREATE TABLE tenant_template.machine_documents (
    id integer NOT NULL,
    equipment_id integer DEFAULT 0 NOT NULL,
    folder_id integer DEFAULT 0 NOT NULL,
    name character varying(255),
    is_main boolean DEFAULT false NOT NULL,
    is_locked boolean DEFAULT false NOT NULL,
    legacy_id bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: machine_documents_id_seq; Type: SEQUENCE; Schema: tenant_template; Owner: -
--

CREATE SEQUENCE tenant_template.machine_documents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: machine_documents_id_seq; Type: SEQUENCE OWNED BY; Schema: tenant_template; Owner: -
--

ALTER SEQUENCE tenant_template.machine_documents_id_seq OWNED BY tenant_template.machine_documents.id;


--
-- Name: machine_previous_starts; Type: TABLE; Schema: tenant_template; Owner: -
--

CREATE TABLE tenant_template.machine_previous_starts (
    id integer NOT NULL,
    machine_id integer NOT NULL,
    prev_start_time timestamp with time zone,
    prev_stop_time timestamp with time zone,
    legacy_id bigint
);


--
-- Name: machine_previous_starts_id_seq; Type: SEQUENCE; Schema: tenant_template; Owner: -
--

CREATE SEQUENCE tenant_template.machine_previous_starts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: machine_previous_starts_id_seq; Type: SEQUENCE OWNED BY; Schema: tenant_template; Owner: -
--

ALTER SEQUENCE tenant_template.machine_previous_starts_id_seq OWNED BY tenant_template.machine_previous_starts.id;


--
-- Name: machine_programme_files; Type: TABLE; Schema: tenant_template; Owner: -
--

CREATE TABLE tenant_template.machine_programme_files (
    id integer NOT NULL,
    programme_id integer NOT NULL,
    filename character varying(255) NOT NULL,
    user_id integer DEFAULT 0 NOT NULL,
    uploaded_by_email character varying(255) DEFAULT ''::character varying NOT NULL,
    uploaded_by_name character varying(255) DEFAULT ''::character varying NOT NULL,
    legacy_id bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: machine_programme_files_id_seq; Type: SEQUENCE; Schema: tenant_template; Owner: -
--

CREATE SEQUENCE tenant_template.machine_programme_files_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: machine_programme_files_id_seq; Type: SEQUENCE OWNED BY; Schema: tenant_template; Owner: -
--

ALTER SEQUENCE tenant_template.machine_programme_files_id_seq OWNED BY tenant_template.machine_programme_files.id;


--
-- Name: machine_programmes; Type: TABLE; Schema: tenant_template; Owner: -
--

CREATE TABLE tenant_template.machine_programmes (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    status smallint DEFAULT 1 NOT NULL,
    legacy_id bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: machine_programmes_id_seq; Type: SEQUENCE; Schema: tenant_template; Owner: -
--

CREATE SEQUENCE tenant_template.machine_programmes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: machine_programmes_id_seq; Type: SEQUENCE OWNED BY; Schema: tenant_template; Owner: -
--

ALTER SEQUENCE tenant_template.machine_programmes_id_seq OWNED BY tenant_template.machine_programmes.id;


--
-- Name: machine_status; Type: TABLE; Schema: tenant_template; Owner: -
--

CREATE TABLE tenant_template.machine_status (
    id integer NOT NULL,
    machine_id integer NOT NULL,
    status tenant_template."MachineRunningStatus" NOT NULL,
    "time" character varying(30),
    legacy_id bigint
);


--
-- Name: machine_status_id_seq; Type: SEQUENCE; Schema: tenant_template; Owner: -
--

CREATE SEQUENCE tenant_template.machine_status_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: machine_status_id_seq; Type: SEQUENCE OWNED BY; Schema: tenant_template; Owner: -
--

ALTER SEQUENCE tenant_template.machine_status_id_seq OWNED BY tenant_template.machine_status.id;


--
-- Name: machine_user_settings; Type: TABLE; Schema: tenant_template; Owner: -
--

CREATE TABLE tenant_template.machine_user_settings (
    id integer NOT NULL,
    user_id integer NOT NULL,
    user_email character varying(255) DEFAULT ''::character varying NOT NULL,
    user_name character varying(255) DEFAULT ''::character varying NOT NULL,
    machine_id integer NOT NULL,
    is_voice_msg boolean DEFAULT false NOT NULL,
    is_vibrate boolean DEFAULT false NOT NULL,
    is_sound boolean DEFAULT true NOT NULL,
    sound_file_name character varying(100),
    legacy_id bigint
);


--
-- Name: machine_user_settings_id_seq; Type: SEQUENCE; Schema: tenant_template; Owner: -
--

CREATE SEQUENCE tenant_template.machine_user_settings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: machine_user_settings_id_seq; Type: SEQUENCE OWNED BY; Schema: tenant_template; Owner: -
--

ALTER SEQUENCE tenant_template.machine_user_settings_id_seq OWNED BY tenant_template.machine_user_settings.id;


--
-- Name: machines; Type: TABLE; Schema: tenant_template; Owner: -
--

CREATE TABLE tenant_template.machines (
    id integer NOT NULL,
    equipment_id integer DEFAULT 0 NOT NULL,
    pin_no smallint NOT NULL,
    installation_date timestamp with time zone,
    running_status tenant_template."MachineRunningStatus" NOT NULL,
    wifi_id character varying(50),
    bluetooth_id character varying(50),
    has_unregister_data character varying(3) DEFAULT 'no'::character varying NOT NULL,
    filter_time integer DEFAULT 0 NOT NULL,
    filter_time_on integer DEFAULT 0 NOT NULL,
    unit_name character varying(50) NOT NULL,
    unit_connected character varying(3) DEFAULT 'yes'::character varying NOT NULL,
    last_online timestamp with time zone,
    signal_type tenant_template."MachineSignalType" DEFAULT 'on'::tenant_template."MachineSignalType" NOT NULL,
    log_warning boolean DEFAULT false NOT NULL,
    custom_notification_text character varying(100),
    notification_default boolean DEFAULT true NOT NULL,
    is_auto_registered character varying(3) DEFAULT 'no'::character varying NOT NULL,
    auto_registered_data text,
    counter_details text,
    parent_id integer,
    legacy_id bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: machines_id_seq; Type: SEQUENCE; Schema: tenant_template; Owner: -
--

CREATE SEQUENCE tenant_template.machines_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: machines_id_seq; Type: SEQUENCE OWNED BY; Schema: tenant_template; Owner: -
--

ALTER SEQUENCE tenant_template.machines_id_seq OWNED BY tenant_template.machines.id;


--
-- Name: orders; Type: TABLE; Schema: tenant_template; Owner: -
--

CREATE TABLE tenant_template.orders (
    id integer NOT NULL,
    status smallint DEFAULT 1 NOT NULL,
    type_id integer NOT NULL,
    order_nr character varying(50) NOT NULL,
    description character varying(255) NOT NULL,
    flow_id integer NOT NULL,
    equipment_id integer NOT NULL,
    part_id integer NOT NULL,
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    planned_qty integer DEFAULT 0 NOT NULL,
    ok_qty integer DEFAULT 0 NOT NULL,
    scrap_qty integer DEFAULT 0 NOT NULL,
    planned_hrs integer DEFAULT 0 NOT NULL,
    worked_hrs integer DEFAULT 0 NOT NULL,
    remaining_qty integer DEFAULT 0 NOT NULL,
    remaining_hrs integer DEFAULT 0 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    legacy_id bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp with time zone
);


--
-- Name: orders_id_seq; Type: SEQUENCE; Schema: tenant_template; Owner: -
--

CREATE SEQUENCE tenant_template.orders_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: orders_id_seq; Type: SEQUENCE OWNED BY; Schema: tenant_template; Owner: -
--

ALTER SEQUENCE tenant_template.orders_id_seq OWNED BY tenant_template.orders.id;


--
-- Name: parts; Type: TABLE; Schema: tenant_template; Owner: -
--

CREATE TABLE tenant_template.parts (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    part_no character varying(255) DEFAULT '0'::character varying NOT NULL,
    description text,
    status smallint DEFAULT 1 NOT NULL,
    type_id integer DEFAULT 0 NOT NULL,
    purchase_price numeric(10,0) DEFAULT 0 NOT NULL,
    sales_price numeric(10,0) DEFAULT 0 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    legacy_id bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp with time zone
);


--
-- Name: parts_id_seq; Type: SEQUENCE; Schema: tenant_template; Owner: -
--

CREATE SEQUENCE tenant_template.parts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: parts_id_seq; Type: SEQUENCE OWNED BY; Schema: tenant_template; Owner: -
--

ALTER SEQUENCE tenant_template.parts_id_seq OWNED BY tenant_template.parts.id;


--
-- Name: production_data; Type: TABLE; Schema: tenant_template; Owner: -
--

CREATE TABLE tenant_template.production_data (
    id integer NOT NULL,
    flow_id integer DEFAULT 0 NOT NULL,
    flow_object_key integer DEFAULT 0 NOT NULL,
    part_id integer DEFAULT 0 NOT NULL,
    work_shift_id integer DEFAULT 0 NOT NULL,
    work_hours character varying(10),
    part_qty integer DEFAULT 0 NOT NULL,
    planned_qty integer DEFAULT 0 NOT NULL,
    order_no character varying(255) DEFAULT ''::character varying,
    date date,
    status smallint DEFAULT 1 NOT NULL,
    comment character varying(255) DEFAULT ''::character varying NOT NULL,
    created_by integer DEFAULT 0 NOT NULL,
    created_by_email character varying(255) DEFAULT ''::character varying NOT NULL,
    created_by_name character varying(255) DEFAULT ''::character varying NOT NULL,
    work_shift_name character varying(50),
    legacy_id bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp with time zone
);


--
-- Name: production_data_id_seq; Type: SEQUENCE; Schema: tenant_template; Owner: -
--

CREATE SEQUENCE tenant_template.production_data_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: production_data_id_seq; Type: SEQUENCE OWNED BY; Schema: tenant_template; Owner: -
--

ALTER SEQUENCE tenant_template.production_data_id_seq OWNED BY tenant_template.production_data.id;


--
-- Name: salary_group; Type: TABLE; Schema: tenant_template; Owner: -
--

CREATE TABLE tenant_template.salary_group (
    id integer NOT NULL,
    name character varying(255),
    hourly_rate numeric(10,0) DEFAULT 0 NOT NULL,
    info character varying(512) DEFAULT ''::character varying NOT NULL,
    legacy_id bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp with time zone
);


--
-- Name: salary_group_id_seq; Type: SEQUENCE; Schema: tenant_template; Owner: -
--

CREATE SEQUENCE tenant_template.salary_group_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: salary_group_id_seq; Type: SEQUENCE OWNED BY; Schema: tenant_template; Owner: -
--

ALTER SEQUENCE tenant_template.salary_group_id_seq OWNED BY tenant_template.salary_group.id;


--
-- Name: scrap_data; Type: TABLE; Schema: tenant_template; Owner: -
--

CREATE TABLE tenant_template.scrap_data (
    id integer NOT NULL,
    flow_id integer DEFAULT 0 NOT NULL,
    flow_object_key integer DEFAULT 0 NOT NULL,
    part_id integer DEFAULT 0 NOT NULL,
    work_shift_id integer DEFAULT 0 NOT NULL,
    order_no character varying(255) DEFAULT ''::character varying,
    quantity integer,
    reason integer DEFAULT 0 NOT NULL,
    date date,
    status smallint DEFAULT 1 NOT NULL,
    comment character varying(255) DEFAULT ''::character varying NOT NULL,
    created_by integer DEFAULT 0 NOT NULL,
    created_by_email character varying(255) DEFAULT ''::character varying NOT NULL,
    created_by_name character varying(255) DEFAULT ''::character varying NOT NULL,
    scrap_type_id integer DEFAULT 0 NOT NULL,
    picture character varying(255),
    work_shift_name character varying(50),
    legacy_id bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp with time zone
);


--
-- Name: scrap_data_id_seq; Type: SEQUENCE; Schema: tenant_template; Owner: -
--

CREATE SEQUENCE tenant_template.scrap_data_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: scrap_data_id_seq; Type: SEQUENCE OWNED BY; Schema: tenant_template; Owner: -
--

ALTER SEQUENCE tenant_template.scrap_data_id_seq OWNED BY tenant_template.scrap_data.id;


--
-- Name: scrap_reasons; Type: TABLE; Schema: tenant_template; Owner: -
--

CREATE TABLE tenant_template.scrap_reasons (
    id integer NOT NULL,
    name character varying(255),
    status smallint DEFAULT 1 NOT NULL,
    type_id integer DEFAULT 0 NOT NULL,
    description character varying(255) DEFAULT ''::character varying NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    legacy_id bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: scrap_reasons_id_seq; Type: SEQUENCE; Schema: tenant_template; Owner: -
--

CREATE SEQUENCE tenant_template.scrap_reasons_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: scrap_reasons_id_seq; Type: SEQUENCE OWNED BY; Schema: tenant_template; Owner: -
--

ALTER SEQUENCE tenant_template.scrap_reasons_id_seq OWNED BY tenant_template.scrap_reasons.id;


--
-- Name: shift_schedule_data; Type: TABLE; Schema: tenant_template; Owner: -
--

CREATE TABLE tenant_template.shift_schedule_data (
    id integer NOT NULL,
    parent_id integer DEFAULT 0 NOT NULL,
    title character varying(100) NOT NULL,
    schedule_id integer NOT NULL,
    start timestamp with time zone,
    "end" timestamp with time zone,
    text_color character varying(20) NOT NULL,
    background_color character varying(20) NOT NULL,
    is_recurring boolean DEFAULT false NOT NULL,
    rc_data text,
    break_data text,
    legacy_id bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: shift_schedule_data_id_seq; Type: SEQUENCE; Schema: tenant_template; Owner: -
--

CREATE SEQUENCE tenant_template.shift_schedule_data_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shift_schedule_data_id_seq; Type: SEQUENCE OWNED BY; Schema: tenant_template; Owner: -
--

ALTER SEQUENCE tenant_template.shift_schedule_data_id_seq OWNED BY tenant_template.shift_schedule_data.id;


--
-- Name: shift_schedules; Type: TABLE; Schema: tenant_template; Owner: -
--

CREATE TABLE tenant_template.shift_schedules (
    id integer NOT NULL,
    status boolean DEFAULT true NOT NULL,
    title character varying(100) NOT NULL,
    description character varying(512),
    legacy_id bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp with time zone
);


--
-- Name: shift_schedules_id_seq; Type: SEQUENCE; Schema: tenant_template; Owner: -
--

CREATE SEQUENCE tenant_template.shift_schedules_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: shift_schedules_id_seq; Type: SEQUENCE OWNED BY; Schema: tenant_template; Owner: -
--

ALTER SEQUENCE tenant_template.shift_schedules_id_seq OWNED BY tenant_template.shift_schedules.id;


--
-- Name: stop_category; Type: TABLE; Schema: tenant_template; Owner: -
--

CREATE TABLE tenant_template.stop_category (
    id integer NOT NULL,
    name character varying(255),
    type tenant_template."StopCategoryKind" DEFAULT 'Performance'::tenant_template."StopCategoryKind" NOT NULL,
    description character varying(512) DEFAULT ''::character varying NOT NULL,
    icon character varying(255),
    is_active boolean DEFAULT true NOT NULL,
    legacy_id bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp with time zone
);


--
-- Name: stop_category_id_seq; Type: SEQUENCE; Schema: tenant_template; Owner: -
--

CREATE SEQUENCE tenant_template.stop_category_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stop_category_id_seq; Type: SEQUENCE OWNED BY; Schema: tenant_template; Owner: -
--

ALTER SEQUENCE tenant_template.stop_category_id_seq OWNED BY tenant_template.stop_category.id;


--
-- Name: stop_data; Type: TABLE; Schema: tenant_template; Owner: -
--

CREATE TABLE tenant_template.stop_data (
    id integer NOT NULL,
    flow_id integer DEFAULT 0 NOT NULL,
    flow_object_key integer DEFAULT 0 NOT NULL,
    part_id integer DEFAULT 0 NOT NULL,
    work_shift_id integer DEFAULT 0 NOT NULL,
    order_no character varying(255) DEFAULT ''::character varying,
    date date,
    reason integer DEFAULT 0,
    hours integer DEFAULT 0 NOT NULL,
    minutes integer DEFAULT 0 NOT NULL,
    "time" character varying(20),
    quantity integer DEFAULT 0 NOT NULL,
    sum_of_time integer DEFAULT 0 NOT NULL,
    stop_timestamp timestamp with time zone,
    restart_timestamp timestamp with time zone,
    status smallint DEFAULT 1 NOT NULL,
    comment character varying(255) DEFAULT ''::character varying NOT NULL,
    created_by integer DEFAULT 0 NOT NULL,
    created_by_email character varying(255) DEFAULT ''::character varying NOT NULL,
    created_by_name character varying(255) DEFAULT ''::character varying NOT NULL,
    stop_type_id integer DEFAULT 0 NOT NULL,
    picture character varying(255),
    work_shift_name character varying(50),
    machine_stop_id integer DEFAULT 0 NOT NULL,
    stop_data_type tenant_template."StopDataKind" DEFAULT 'reg'::tenant_template."StopDataKind",
    legacy_id bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    deleted_at timestamp with time zone
);


--
-- Name: stop_data_id_seq; Type: SEQUENCE; Schema: tenant_template; Owner: -
--

CREATE SEQUENCE tenant_template.stop_data_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stop_data_id_seq; Type: SEQUENCE OWNED BY; Schema: tenant_template; Owner: -
--

ALTER SEQUENCE tenant_template.stop_data_id_seq OWNED BY tenant_template.stop_data.id;


--
-- Name: stop_reasons; Type: TABLE; Schema: tenant_template; Owner: -
--

CREATE TABLE tenant_template.stop_reasons (
    id integer NOT NULL,
    name character varying(255),
    status smallint DEFAULT 1 NOT NULL,
    type_id integer DEFAULT 0 NOT NULL,
    description character varying(255) DEFAULT ''::character varying NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    legacy_id bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: stop_reasons_id_seq; Type: SEQUENCE; Schema: tenant_template; Owner: -
--

CREATE SEQUENCE tenant_template.stop_reasons_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: stop_reasons_id_seq; Type: SEQUENCE OWNED BY; Schema: tenant_template; Owner: -
--

ALTER SEQUENCE tenant_template.stop_reasons_id_seq OWNED BY tenant_template.stop_reasons.id;


--
-- Name: symbols; Type: TABLE; Schema: tenant_template; Owner: -
--

CREATE TABLE tenant_template.symbols (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    image character varying(255),
    status smallint DEFAULT 1 NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    legacy_id bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: symbols_id_seq; Type: SEQUENCE; Schema: tenant_template; Owner: -
--

CREATE SEQUENCE tenant_template.symbols_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: symbols_id_seq; Type: SEQUENCE OWNED BY; Schema: tenant_template; Owner: -
--

ALTER SEQUENCE tenant_template.symbols_id_seq OWNED BY tenant_template.symbols.id;


--
-- Name: tenant_machines; Type: TABLE; Schema: tenant_template; Owner: -
--

CREATE TABLE tenant_template.tenant_machines (
    id integer NOT NULL,
    programme_id integer NOT NULL,
    legacy_id bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: tenant_machines_id_seq; Type: SEQUENCE; Schema: tenant_template; Owner: -
--

CREATE SEQUENCE tenant_template.tenant_machines_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: tenant_machines_id_seq; Type: SEQUENCE OWNED BY; Schema: tenant_template; Owner: -
--

ALTER SEQUENCE tenant_template.tenant_machines_id_seq OWNED BY tenant_template.tenant_machines.id;


--
-- Name: types; Type: TABLE; Schema: tenant_template; Owner: -
--

CREATE TABLE tenant_template.types (
    id integer NOT NULL,
    name character varying(255),
    type tenant_template."TypeKind" DEFAULT 'NotApplicable'::tenant_template."TypeKind" NOT NULL,
    entity tenant_template."TypeEntity" DEFAULT 'Equipment'::tenant_template."TypeEntity" NOT NULL,
    description text,
    icon character varying(255) DEFAULT 'noimage.jpg'::character varying,
    is_active boolean DEFAULT true NOT NULL,
    exclude_type boolean DEFAULT false NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    legacy_id bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: types_id_seq; Type: SEQUENCE; Schema: tenant_template; Owner: -
--

CREATE SEQUENCE tenant_template.types_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: types_id_seq; Type: SEQUENCE OWNED BY; Schema: tenant_template; Owner: -
--

ALTER SEQUENCE tenant_template.types_id_seq OWNED BY tenant_template.types.id;


--
-- Name: user_equipments; Type: TABLE; Schema: tenant_template; Owner: -
--

CREATE TABLE tenant_template.user_equipments (
    id integer NOT NULL,
    user_id integer NOT NULL,
    user_email character varying(255) DEFAULT ''::character varying NOT NULL,
    user_name character varying(255) DEFAULT ''::character varying NOT NULL,
    equipment_id integer DEFAULT 0 NOT NULL,
    icon character varying(255) DEFAULT 'noimage.jpg'::character varying NOT NULL,
    status smallint DEFAULT 1 NOT NULL,
    legacy_id bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: user_equipments_id_seq; Type: SEQUENCE; Schema: tenant_template; Owner: -
--

CREATE SEQUENCE tenant_template.user_equipments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_equipments_id_seq; Type: SEQUENCE OWNED BY; Schema: tenant_template; Owner: -
--

ALTER SEQUENCE tenant_template.user_equipments_id_seq OWNED BY tenant_template.user_equipments.id;


--
-- Name: user_file_locks; Type: TABLE; Schema: tenant_template; Owner: -
--

CREATE TABLE tenant_template.user_file_locks (
    id integer NOT NULL,
    user_id integer NOT NULL,
    user_email character varying(255) DEFAULT ''::character varying NOT NULL,
    user_name character varying(255) DEFAULT ''::character varying NOT NULL,
    type tenant_template."FileLockType" DEFAULT 'lock'::tenant_template."FileLockType" NOT NULL,
    machine_id integer DEFAULT 0 NOT NULL,
    machine_file_id integer DEFAULT 0 NOT NULL,
    is_locked boolean DEFAULT false NOT NULL,
    legacy_id bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: user_file_locks_id_seq; Type: SEQUENCE; Schema: tenant_template; Owner: -
--

CREATE SEQUENCE tenant_template.user_file_locks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_file_locks_id_seq; Type: SEQUENCE OWNED BY; Schema: tenant_template; Owner: -
--

ALTER SEQUENCE tenant_template.user_file_locks_id_seq OWNED BY tenant_template.user_file_locks.id;


--
-- Name: warning_data; Type: TABLE; Schema: tenant_template; Owner: -
--

CREATE TABLE tenant_template.warning_data (
    id integer NOT NULL,
    equipment_id integer NOT NULL,
    machine_id integer NOT NULL,
    notification_text character varying(512) NOT NULL,
    from_time timestamp with time zone,
    to_time timestamp with time zone,
    duration integer DEFAULT 0 NOT NULL,
    created_by integer DEFAULT 0 NOT NULL,
    created_by_email character varying(255) DEFAULT ''::character varying NOT NULL,
    created_by_name character varying(255) DEFAULT ''::character varying NOT NULL,
    legacy_id bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: warning_data_id_seq; Type: SEQUENCE; Schema: tenant_template; Owner: -
--

CREATE SEQUENCE tenant_template.warning_data_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: warning_data_id_seq; Type: SEQUENCE OWNED BY; Schema: tenant_template; Owner: -
--

ALTER SEQUENCE tenant_template.warning_data_id_seq OWNED BY tenant_template.warning_data.id;


--
-- Name: work_shifts; Type: TABLE; Schema: tenant_template; Owner: -
--

CREATE TABLE tenant_template.work_shifts (
    id integer NOT NULL,
    name character varying(255),
    start_time time without time zone,
    end_time time without time zone,
    break_start_time time without time zone,
    break_end_time time without time zone,
    break_times character varying(512),
    working_days character varying(50),
    status smallint DEFAULT 1 NOT NULL,
    legacy_id bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: work_shifts_id_seq; Type: SEQUENCE; Schema: tenant_template; Owner: -
--

CREATE SEQUENCE tenant_template.work_shifts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: work_shifts_id_seq; Type: SEQUENCE OWNED BY; Schema: tenant_template; Owner: -
--

ALTER SEQUENCE tenant_template.work_shifts_id_seq OWNED BY tenant_template.work_shifts.id;


--
-- Name: workstations; Type: TABLE; Schema: tenant_template; Owner: -
--

CREATE TABLE tenant_template.workstations (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    machine_id integer,
    status smallint DEFAULT 1 NOT NULL,
    legacy_id bigint,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: workstations_id_seq; Type: SEQUENCE; Schema: tenant_template; Owner: -
--

CREATE SEQUENCE tenant_template.workstations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: workstations_id_seq; Type: SEQUENCE OWNED BY; Schema: tenant_template; Owner: -
--

ALTER SEQUENCE tenant_template.workstations_id_seq OWNED BY tenant_template.workstations.id;


--
-- Name: dashboard_widgets id; Type: DEFAULT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.dashboard_widgets ALTER COLUMN id SET DEFAULT nextval('tenant_template.dashboard_widgets_id_seq'::regclass);


--
-- Name: dashboards id; Type: DEFAULT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.dashboards ALTER COLUMN id SET DEFAULT nextval('tenant_template.dashboards_id_seq'::regclass);


--
-- Name: equipment id; Type: DEFAULT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.equipment ALTER COLUMN id SET DEFAULT nextval('tenant_template.equipment_id_seq'::regclass);


--
-- Name: equipment_assign id; Type: DEFAULT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.equipment_assign ALTER COLUMN id SET DEFAULT nextval('tenant_template.equipment_assign_id_seq'::regclass);


--
-- Name: equipment_orders id; Type: DEFAULT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.equipment_orders ALTER COLUMN id SET DEFAULT nextval('tenant_template.equipment_orders_id_seq'::regclass);


--
-- Name: equipment_parts id; Type: DEFAULT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.equipment_parts ALTER COLUMN id SET DEFAULT nextval('tenant_template.equipment_parts_id_seq'::regclass);


--
-- Name: equipment_properties id; Type: DEFAULT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.equipment_properties ALTER COLUMN id SET DEFAULT nextval('tenant_template.equipment_properties_id_seq'::regclass);


--
-- Name: equipment_scrap_reasons id; Type: DEFAULT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.equipment_scrap_reasons ALTER COLUMN id SET DEFAULT nextval('tenant_template.equipment_scrap_reasons_id_seq'::regclass);


--
-- Name: equipment_shift_schedule id; Type: DEFAULT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.equipment_shift_schedule ALTER COLUMN id SET DEFAULT nextval('tenant_template.equipment_shift_schedule_id_seq'::regclass);


--
-- Name: equipment_stop_reasons id; Type: DEFAULT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.equipment_stop_reasons ALTER COLUMN id SET DEFAULT nextval('tenant_template.equipment_stop_reasons_id_seq'::regclass);


--
-- Name: flow_design_attributes id; Type: DEFAULT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.flow_design_attributes ALTER COLUMN id SET DEFAULT nextval('tenant_template.flow_design_attributes_id_seq'::regclass);


--
-- Name: flow_designs id; Type: DEFAULT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.flow_designs ALTER COLUMN id SET DEFAULT nextval('tenant_template.flow_designs_id_seq'::regclass);


--
-- Name: folders id; Type: DEFAULT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.folders ALTER COLUMN id SET DEFAULT nextval('tenant_template.folders_id_seq'::regclass);


--
-- Name: machine_data id; Type: DEFAULT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.machine_data ALTER COLUMN id SET DEFAULT nextval('tenant_template.machine_data_id_seq'::regclass);


--
-- Name: machine_document_files id; Type: DEFAULT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.machine_document_files ALTER COLUMN id SET DEFAULT nextval('tenant_template.machine_document_files_id_seq'::regclass);


--
-- Name: machine_documents id; Type: DEFAULT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.machine_documents ALTER COLUMN id SET DEFAULT nextval('tenant_template.machine_documents_id_seq'::regclass);


--
-- Name: machine_previous_starts id; Type: DEFAULT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.machine_previous_starts ALTER COLUMN id SET DEFAULT nextval('tenant_template.machine_previous_starts_id_seq'::regclass);


--
-- Name: machine_programme_files id; Type: DEFAULT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.machine_programme_files ALTER COLUMN id SET DEFAULT nextval('tenant_template.machine_programme_files_id_seq'::regclass);


--
-- Name: machine_programmes id; Type: DEFAULT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.machine_programmes ALTER COLUMN id SET DEFAULT nextval('tenant_template.machine_programmes_id_seq'::regclass);


--
-- Name: machine_status id; Type: DEFAULT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.machine_status ALTER COLUMN id SET DEFAULT nextval('tenant_template.machine_status_id_seq'::regclass);


--
-- Name: machine_user_settings id; Type: DEFAULT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.machine_user_settings ALTER COLUMN id SET DEFAULT nextval('tenant_template.machine_user_settings_id_seq'::regclass);


--
-- Name: machines id; Type: DEFAULT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.machines ALTER COLUMN id SET DEFAULT nextval('tenant_template.machines_id_seq'::regclass);


--
-- Name: orders id; Type: DEFAULT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.orders ALTER COLUMN id SET DEFAULT nextval('tenant_template.orders_id_seq'::regclass);


--
-- Name: parts id; Type: DEFAULT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.parts ALTER COLUMN id SET DEFAULT nextval('tenant_template.parts_id_seq'::regclass);


--
-- Name: production_data id; Type: DEFAULT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.production_data ALTER COLUMN id SET DEFAULT nextval('tenant_template.production_data_id_seq'::regclass);


--
-- Name: salary_group id; Type: DEFAULT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.salary_group ALTER COLUMN id SET DEFAULT nextval('tenant_template.salary_group_id_seq'::regclass);


--
-- Name: scrap_data id; Type: DEFAULT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.scrap_data ALTER COLUMN id SET DEFAULT nextval('tenant_template.scrap_data_id_seq'::regclass);


--
-- Name: scrap_reasons id; Type: DEFAULT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.scrap_reasons ALTER COLUMN id SET DEFAULT nextval('tenant_template.scrap_reasons_id_seq'::regclass);


--
-- Name: shift_schedule_data id; Type: DEFAULT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.shift_schedule_data ALTER COLUMN id SET DEFAULT nextval('tenant_template.shift_schedule_data_id_seq'::regclass);


--
-- Name: shift_schedules id; Type: DEFAULT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.shift_schedules ALTER COLUMN id SET DEFAULT nextval('tenant_template.shift_schedules_id_seq'::regclass);


--
-- Name: stop_category id; Type: DEFAULT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.stop_category ALTER COLUMN id SET DEFAULT nextval('tenant_template.stop_category_id_seq'::regclass);


--
-- Name: stop_data id; Type: DEFAULT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.stop_data ALTER COLUMN id SET DEFAULT nextval('tenant_template.stop_data_id_seq'::regclass);


--
-- Name: stop_reasons id; Type: DEFAULT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.stop_reasons ALTER COLUMN id SET DEFAULT nextval('tenant_template.stop_reasons_id_seq'::regclass);


--
-- Name: symbols id; Type: DEFAULT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.symbols ALTER COLUMN id SET DEFAULT nextval('tenant_template.symbols_id_seq'::regclass);


--
-- Name: tenant_machines id; Type: DEFAULT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.tenant_machines ALTER COLUMN id SET DEFAULT nextval('tenant_template.tenant_machines_id_seq'::regclass);


--
-- Name: types id; Type: DEFAULT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.types ALTER COLUMN id SET DEFAULT nextval('tenant_template.types_id_seq'::regclass);


--
-- Name: user_equipments id; Type: DEFAULT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.user_equipments ALTER COLUMN id SET DEFAULT nextval('tenant_template.user_equipments_id_seq'::regclass);


--
-- Name: user_file_locks id; Type: DEFAULT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.user_file_locks ALTER COLUMN id SET DEFAULT nextval('tenant_template.user_file_locks_id_seq'::regclass);


--
-- Name: warning_data id; Type: DEFAULT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.warning_data ALTER COLUMN id SET DEFAULT nextval('tenant_template.warning_data_id_seq'::regclass);


--
-- Name: work_shifts id; Type: DEFAULT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.work_shifts ALTER COLUMN id SET DEFAULT nextval('tenant_template.work_shifts_id_seq'::regclass);


--
-- Name: workstations id; Type: DEFAULT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.workstations ALTER COLUMN id SET DEFAULT nextval('tenant_template.workstations_id_seq'::regclass);


--
-- Name: dashboard_widgets dashboard_widgets_pkey; Type: CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.dashboard_widgets
    ADD CONSTRAINT dashboard_widgets_pkey PRIMARY KEY (id);


--
-- Name: dashboards dashboards_pkey; Type: CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.dashboards
    ADD CONSTRAINT dashboards_pkey PRIMARY KEY (id);


--
-- Name: equipment_assign equipment_assign_pkey; Type: CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.equipment_assign
    ADD CONSTRAINT equipment_assign_pkey PRIMARY KEY (id);


--
-- Name: equipment_orders equipment_orders_pkey; Type: CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.equipment_orders
    ADD CONSTRAINT equipment_orders_pkey PRIMARY KEY (id);


--
-- Name: equipment_parts equipment_parts_pkey; Type: CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.equipment_parts
    ADD CONSTRAINT equipment_parts_pkey PRIMARY KEY (id);


--
-- Name: equipment equipment_pkey; Type: CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.equipment
    ADD CONSTRAINT equipment_pkey PRIMARY KEY (id);


--
-- Name: equipment_properties equipment_properties_pkey; Type: CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.equipment_properties
    ADD CONSTRAINT equipment_properties_pkey PRIMARY KEY (id);


--
-- Name: equipment_scrap_reasons equipment_scrap_reasons_pkey; Type: CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.equipment_scrap_reasons
    ADD CONSTRAINT equipment_scrap_reasons_pkey PRIMARY KEY (id);


--
-- Name: equipment_shift_schedule equipment_shift_schedule_pkey; Type: CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.equipment_shift_schedule
    ADD CONSTRAINT equipment_shift_schedule_pkey PRIMARY KEY (id);


--
-- Name: equipment_stop_reasons equipment_stop_reasons_pkey; Type: CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.equipment_stop_reasons
    ADD CONSTRAINT equipment_stop_reasons_pkey PRIMARY KEY (id);


--
-- Name: flow_design_attributes flow_design_attributes_pkey; Type: CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.flow_design_attributes
    ADD CONSTRAINT flow_design_attributes_pkey PRIMARY KEY (id);


--
-- Name: flow_designs flow_designs_pkey; Type: CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.flow_designs
    ADD CONSTRAINT flow_designs_pkey PRIMARY KEY (id);


--
-- Name: folders folders_pkey; Type: CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.folders
    ADD CONSTRAINT folders_pkey PRIMARY KEY (id);


--
-- Name: machine_data machine_data_pkey; Type: CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.machine_data
    ADD CONSTRAINT machine_data_pkey PRIMARY KEY (id);


--
-- Name: machine_document_files machine_document_files_pkey; Type: CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.machine_document_files
    ADD CONSTRAINT machine_document_files_pkey PRIMARY KEY (id);


--
-- Name: machine_documents machine_documents_pkey; Type: CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.machine_documents
    ADD CONSTRAINT machine_documents_pkey PRIMARY KEY (id);


--
-- Name: machine_previous_starts machine_previous_starts_pkey; Type: CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.machine_previous_starts
    ADD CONSTRAINT machine_previous_starts_pkey PRIMARY KEY (id);


--
-- Name: machine_programme_files machine_programme_files_pkey; Type: CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.machine_programme_files
    ADD CONSTRAINT machine_programme_files_pkey PRIMARY KEY (id);


--
-- Name: machine_programmes machine_programmes_pkey; Type: CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.machine_programmes
    ADD CONSTRAINT machine_programmes_pkey PRIMARY KEY (id);


--
-- Name: machine_status machine_status_pkey; Type: CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.machine_status
    ADD CONSTRAINT machine_status_pkey PRIMARY KEY (id);


--
-- Name: machine_user_settings machine_user_settings_pkey; Type: CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.machine_user_settings
    ADD CONSTRAINT machine_user_settings_pkey PRIMARY KEY (id);


--
-- Name: machines machines_pkey; Type: CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.machines
    ADD CONSTRAINT machines_pkey PRIMARY KEY (id);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: parts parts_pkey; Type: CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.parts
    ADD CONSTRAINT parts_pkey PRIMARY KEY (id);


--
-- Name: production_data production_data_pkey; Type: CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.production_data
    ADD CONSTRAINT production_data_pkey PRIMARY KEY (id);


--
-- Name: salary_group salary_group_pkey; Type: CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.salary_group
    ADD CONSTRAINT salary_group_pkey PRIMARY KEY (id);


--
-- Name: scrap_data scrap_data_pkey; Type: CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.scrap_data
    ADD CONSTRAINT scrap_data_pkey PRIMARY KEY (id);


--
-- Name: scrap_reasons scrap_reasons_pkey; Type: CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.scrap_reasons
    ADD CONSTRAINT scrap_reasons_pkey PRIMARY KEY (id);


--
-- Name: shift_schedule_data shift_schedule_data_pkey; Type: CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.shift_schedule_data
    ADD CONSTRAINT shift_schedule_data_pkey PRIMARY KEY (id);


--
-- Name: shift_schedules shift_schedules_pkey; Type: CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.shift_schedules
    ADD CONSTRAINT shift_schedules_pkey PRIMARY KEY (id);


--
-- Name: stop_category stop_category_pkey; Type: CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.stop_category
    ADD CONSTRAINT stop_category_pkey PRIMARY KEY (id);


--
-- Name: stop_data stop_data_pkey; Type: CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.stop_data
    ADD CONSTRAINT stop_data_pkey PRIMARY KEY (id);


--
-- Name: stop_reasons stop_reasons_pkey; Type: CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.stop_reasons
    ADD CONSTRAINT stop_reasons_pkey PRIMARY KEY (id);


--
-- Name: symbols symbols_pkey; Type: CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.symbols
    ADD CONSTRAINT symbols_pkey PRIMARY KEY (id);


--
-- Name: tenant_machines tenant_machines_pkey; Type: CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.tenant_machines
    ADD CONSTRAINT tenant_machines_pkey PRIMARY KEY (id);


--
-- Name: types types_pkey; Type: CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.types
    ADD CONSTRAINT types_pkey PRIMARY KEY (id);


--
-- Name: user_equipments user_equipments_pkey; Type: CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.user_equipments
    ADD CONSTRAINT user_equipments_pkey PRIMARY KEY (id);


--
-- Name: user_file_locks user_file_locks_pkey; Type: CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.user_file_locks
    ADD CONSTRAINT user_file_locks_pkey PRIMARY KEY (id);


--
-- Name: warning_data warning_data_pkey; Type: CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.warning_data
    ADD CONSTRAINT warning_data_pkey PRIMARY KEY (id);


--
-- Name: work_shifts work_shifts_pkey; Type: CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.work_shifts
    ADD CONSTRAINT work_shifts_pkey PRIMARY KEY (id);


--
-- Name: workstations workstations_pkey; Type: CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.workstations
    ADD CONSTRAINT workstations_pkey PRIMARY KEY (id);


--
-- Name: dashboard_widgets_board_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX dashboard_widgets_board_id_idx ON tenant_template.dashboard_widgets USING btree (board_id);


--
-- Name: dashboard_widgets_deleted_at_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX dashboard_widgets_deleted_at_idx ON tenant_template.dashboard_widgets USING btree (deleted_at);


--
-- Name: dashboard_widgets_legacy_id_key; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE UNIQUE INDEX dashboard_widgets_legacy_id_key ON tenant_template.dashboard_widgets USING btree (legacy_id);


--
-- Name: dashboards_created_by_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX dashboards_created_by_idx ON tenant_template.dashboards USING btree (created_by);


--
-- Name: dashboards_legacy_id_key; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE UNIQUE INDEX dashboards_legacy_id_key ON tenant_template.dashboards USING btree (legacy_id);


--
-- Name: equipment_assign_deleted_at_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX equipment_assign_deleted_at_idx ON tenant_template.equipment_assign USING btree (deleted_at);


--
-- Name: equipment_assign_equipment_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX equipment_assign_equipment_id_idx ON tenant_template.equipment_assign USING btree (equipment_id);


--
-- Name: equipment_assign_legacy_id_key; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE UNIQUE INDEX equipment_assign_legacy_id_key ON tenant_template.equipment_assign USING btree (legacy_id);


--
-- Name: equipment_assign_user_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX equipment_assign_user_id_idx ON tenant_template.equipment_assign USING btree (user_id);


--
-- Name: equipment_deleted_at_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX equipment_deleted_at_idx ON tenant_template.equipment USING btree (deleted_at);


--
-- Name: equipment_is_active_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX equipment_is_active_idx ON tenant_template.equipment USING btree (is_active);


--
-- Name: equipment_legacy_id_key; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE UNIQUE INDEX equipment_legacy_id_key ON tenant_template.equipment USING btree (legacy_id);


--
-- Name: equipment_name_trgm_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX equipment_name_trgm_idx ON tenant_template.equipment USING gin (name public.gin_trgm_ops);


--
-- Name: equipment_orders_deleted_at_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX equipment_orders_deleted_at_idx ON tenant_template.equipment_orders USING btree (deleted_at);


--
-- Name: equipment_orders_equipment_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX equipment_orders_equipment_id_idx ON tenant_template.equipment_orders USING btree (equipment_id);


--
-- Name: equipment_orders_legacy_id_key; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE UNIQUE INDEX equipment_orders_legacy_id_key ON tenant_template.equipment_orders USING btree (legacy_id);


--
-- Name: equipment_orders_order_type_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX equipment_orders_order_type_id_idx ON tenant_template.equipment_orders USING btree (order_type_id);


--
-- Name: equipment_parent_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX equipment_parent_id_idx ON tenant_template.equipment USING btree (parent_id);


--
-- Name: equipment_parent_id_sort_order_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX equipment_parent_id_sort_order_idx ON tenant_template.equipment USING btree (parent_id, sort_order);


--
-- Name: equipment_parts_deleted_at_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX equipment_parts_deleted_at_idx ON tenant_template.equipment_parts USING btree (deleted_at);


--
-- Name: equipment_parts_equipment_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX equipment_parts_equipment_id_idx ON tenant_template.equipment_parts USING btree (equipment_id);


--
-- Name: equipment_parts_legacy_id_key; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE UNIQUE INDEX equipment_parts_legacy_id_key ON tenant_template.equipment_parts USING btree (legacy_id);


--
-- Name: equipment_parts_part_type_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX equipment_parts_part_type_id_idx ON tenant_template.equipment_parts USING btree (part_type_id);


--
-- Name: equipment_properties_equip_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX equipment_properties_equip_id_idx ON tenant_template.equipment_properties USING btree (equip_id);


--
-- Name: equipment_properties_legacy_id_key; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE UNIQUE INDEX equipment_properties_legacy_id_key ON tenant_template.equipment_properties USING btree (legacy_id);


--
-- Name: equipment_properties_salary_group_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX equipment_properties_salary_group_id_idx ON tenant_template.equipment_properties USING btree (salary_group_id);


--
-- Name: equipment_scrap_reasons_deleted_at_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX equipment_scrap_reasons_deleted_at_idx ON tenant_template.equipment_scrap_reasons USING btree (deleted_at);


--
-- Name: equipment_scrap_reasons_equipment_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX equipment_scrap_reasons_equipment_id_idx ON tenant_template.equipment_scrap_reasons USING btree (equipment_id);


--
-- Name: equipment_scrap_reasons_legacy_id_key; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE UNIQUE INDEX equipment_scrap_reasons_legacy_id_key ON tenant_template.equipment_scrap_reasons USING btree (legacy_id);


--
-- Name: equipment_scrap_reasons_reason_type_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX equipment_scrap_reasons_reason_type_id_idx ON tenant_template.equipment_scrap_reasons USING btree (reason_type_id);


--
-- Name: equipment_shift_schedule_equipment_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX equipment_shift_schedule_equipment_id_idx ON tenant_template.equipment_shift_schedule USING btree (equipment_id);


--
-- Name: equipment_shift_schedule_legacy_id_key; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE UNIQUE INDEX equipment_shift_schedule_legacy_id_key ON tenant_template.equipment_shift_schedule USING btree (legacy_id);


--
-- Name: equipment_shift_schedule_schedule_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX equipment_shift_schedule_schedule_id_idx ON tenant_template.equipment_shift_schedule USING btree (schedule_id);


--
-- Name: equipment_stop_reasons_deleted_at_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX equipment_stop_reasons_deleted_at_idx ON tenant_template.equipment_stop_reasons USING btree (deleted_at);


--
-- Name: equipment_stop_reasons_equipment_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX equipment_stop_reasons_equipment_id_idx ON tenant_template.equipment_stop_reasons USING btree (equipment_id);


--
-- Name: equipment_stop_reasons_legacy_id_key; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE UNIQUE INDEX equipment_stop_reasons_legacy_id_key ON tenant_template.equipment_stop_reasons USING btree (legacy_id);


--
-- Name: equipment_stop_reasons_reason_type_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX equipment_stop_reasons_reason_type_id_idx ON tenant_template.equipment_stop_reasons USING btree (reason_type_id);


--
-- Name: equipment_type_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX equipment_type_id_idx ON tenant_template.equipment USING btree (type_id);


--
-- Name: flow_design_attributes_flow_design_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX flow_design_attributes_flow_design_id_idx ON tenant_template.flow_design_attributes USING btree (flow_design_id);


--
-- Name: flow_design_attributes_legacy_id_key; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE UNIQUE INDEX flow_design_attributes_legacy_id_key ON tenant_template.flow_design_attributes USING btree (legacy_id);


--
-- Name: flow_design_attributes_type_relation_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX flow_design_attributes_type_relation_id_idx ON tenant_template.flow_design_attributes USING btree (type, relation_id);


--
-- Name: flow_designs_deleted_at_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX flow_designs_deleted_at_idx ON tenant_template.flow_designs USING btree (deleted_at);


--
-- Name: flow_designs_legacy_id_key; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE UNIQUE INDEX flow_designs_legacy_id_key ON tenant_template.flow_designs USING btree (legacy_id);


--
-- Name: folders_deleted_at_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX folders_deleted_at_idx ON tenant_template.folders USING btree (deleted_at);


--
-- Name: folders_equipment_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX folders_equipment_id_idx ON tenant_template.folders USING btree (equipment_id);


--
-- Name: folders_folder_type_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX folders_folder_type_idx ON tenant_template.folders USING btree (folder_type);


--
-- Name: folders_legacy_id_key; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE UNIQUE INDEX folders_legacy_id_key ON tenant_template.folders USING btree (legacy_id);


--
-- Name: machine_data_legacy_id_key; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE UNIQUE INDEX machine_data_legacy_id_key ON tenant_template.machine_data USING btree (legacy_id);


--
-- Name: machine_data_machine_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX machine_data_machine_id_idx ON tenant_template.machine_data USING btree (machine_id);


--
-- Name: machine_data_machine_id_start_time_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX machine_data_machine_id_start_time_idx ON tenant_template.machine_data USING btree (machine_id, start_time);


--
-- Name: machine_data_start_time_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX machine_data_start_time_idx ON tenant_template.machine_data USING btree (start_time);


--
-- Name: machine_document_files_deleted_at_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX machine_document_files_deleted_at_idx ON tenant_template.machine_document_files USING btree (deleted_at);


--
-- Name: machine_document_files_legacy_id_key; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE UNIQUE INDEX machine_document_files_legacy_id_key ON tenant_template.machine_document_files USING btree (legacy_id);


--
-- Name: machine_document_files_machine_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX machine_document_files_machine_id_idx ON tenant_template.machine_document_files USING btree (machine_id);


--
-- Name: machine_document_files_user_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX machine_document_files_user_id_idx ON tenant_template.machine_document_files USING btree (user_id);


--
-- Name: machine_document_name_trgm_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX machine_document_name_trgm_idx ON tenant_template.machine_documents USING gin (name public.gin_trgm_ops);


--
-- Name: machine_documents_deleted_at_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX machine_documents_deleted_at_idx ON tenant_template.machine_documents USING btree (deleted_at);


--
-- Name: machine_documents_equipment_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX machine_documents_equipment_id_idx ON tenant_template.machine_documents USING btree (equipment_id);


--
-- Name: machine_documents_folder_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX machine_documents_folder_id_idx ON tenant_template.machine_documents USING btree (folder_id);


--
-- Name: machine_documents_legacy_id_key; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE UNIQUE INDEX machine_documents_legacy_id_key ON tenant_template.machine_documents USING btree (legacy_id);


--
-- Name: machine_previous_starts_legacy_id_key; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE UNIQUE INDEX machine_previous_starts_legacy_id_key ON tenant_template.machine_previous_starts USING btree (legacy_id);


--
-- Name: machine_previous_starts_machine_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX machine_previous_starts_machine_id_idx ON tenant_template.machine_previous_starts USING btree (machine_id);


--
-- Name: machine_programme_files_legacy_id_key; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE UNIQUE INDEX machine_programme_files_legacy_id_key ON tenant_template.machine_programme_files USING btree (legacy_id);


--
-- Name: machine_programme_files_programme_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX machine_programme_files_programme_id_idx ON tenant_template.machine_programme_files USING btree (programme_id);


--
-- Name: machine_programme_files_user_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX machine_programme_files_user_id_idx ON tenant_template.machine_programme_files USING btree (user_id);


--
-- Name: machine_programme_name_trgm_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX machine_programme_name_trgm_idx ON tenant_template.machine_programmes USING gin (name public.gin_trgm_ops);


--
-- Name: machine_programmes_legacy_id_key; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE UNIQUE INDEX machine_programmes_legacy_id_key ON tenant_template.machine_programmes USING btree (legacy_id);


--
-- Name: machine_status_legacy_id_key; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE UNIQUE INDEX machine_status_legacy_id_key ON tenant_template.machine_status USING btree (legacy_id);


--
-- Name: machine_status_machine_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX machine_status_machine_id_idx ON tenant_template.machine_status USING btree (machine_id);


--
-- Name: machine_status_time_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX machine_status_time_idx ON tenant_template.machine_status USING btree ("time");


--
-- Name: machine_user_settings_legacy_id_key; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE UNIQUE INDEX machine_user_settings_legacy_id_key ON tenant_template.machine_user_settings USING btree (legacy_id);


--
-- Name: machine_user_settings_machine_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX machine_user_settings_machine_id_idx ON tenant_template.machine_user_settings USING btree (machine_id);


--
-- Name: machine_user_settings_user_id_machine_id_key; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE UNIQUE INDEX machine_user_settings_user_id_machine_id_key ON tenant_template.machine_user_settings USING btree (user_id, machine_id);


--
-- Name: machines_equipment_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX machines_equipment_id_idx ON tenant_template.machines USING btree (equipment_id);


--
-- Name: machines_legacy_id_key; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE UNIQUE INDEX machines_legacy_id_key ON tenant_template.machines USING btree (legacy_id);


--
-- Name: machines_parent_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX machines_parent_id_idx ON tenant_template.machines USING btree (parent_id);


--
-- Name: order_description_trgm_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX order_description_trgm_idx ON tenant_template.orders USING gin (description public.gin_trgm_ops);


--
-- Name: order_nr_trgm_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX order_nr_trgm_idx ON tenant_template.orders USING gin (order_nr public.gin_trgm_ops);


--
-- Name: orders_deleted_at_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX orders_deleted_at_idx ON tenant_template.orders USING btree (deleted_at);


--
-- Name: orders_equipment_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX orders_equipment_id_idx ON tenant_template.orders USING btree (equipment_id);


--
-- Name: orders_flow_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX orders_flow_id_idx ON tenant_template.orders USING btree (flow_id);


--
-- Name: orders_legacy_id_key; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE UNIQUE INDEX orders_legacy_id_key ON tenant_template.orders USING btree (legacy_id);


--
-- Name: orders_order_nr_key; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE UNIQUE INDEX orders_order_nr_key ON tenant_template.orders USING btree (order_nr);


--
-- Name: orders_part_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX orders_part_id_idx ON tenant_template.orders USING btree (part_id);


--
-- Name: orders_start_date_end_date_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX orders_start_date_end_date_idx ON tenant_template.orders USING btree (start_date, end_date);


--
-- Name: orders_type_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX orders_type_id_idx ON tenant_template.orders USING btree (type_id);


--
-- Name: part_name_trgm_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX part_name_trgm_idx ON tenant_template.parts USING gin (name public.gin_trgm_ops);


--
-- Name: part_no_trgm_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX part_no_trgm_idx ON tenant_template.parts USING gin (part_no public.gin_trgm_ops);


--
-- Name: parts_deleted_at_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX parts_deleted_at_idx ON tenant_template.parts USING btree (deleted_at);


--
-- Name: parts_legacy_id_key; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE UNIQUE INDEX parts_legacy_id_key ON tenant_template.parts USING btree (legacy_id);


--
-- Name: parts_type_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX parts_type_id_idx ON tenant_template.parts USING btree (type_id);


--
-- Name: production_data_created_by_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX production_data_created_by_idx ON tenant_template.production_data USING btree (created_by);


--
-- Name: production_data_deleted_at_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX production_data_deleted_at_idx ON tenant_template.production_data USING btree (deleted_at);


--
-- Name: production_data_flow_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX production_data_flow_id_idx ON tenant_template.production_data USING btree (flow_id);


--
-- Name: production_data_flow_id_work_shift_id_date_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX production_data_flow_id_work_shift_id_date_idx ON tenant_template.production_data USING btree (flow_id, work_shift_id, date);


--
-- Name: production_data_flow_object_key_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX production_data_flow_object_key_idx ON tenant_template.production_data USING btree (flow_object_key);


--
-- Name: production_data_legacy_id_key; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE UNIQUE INDEX production_data_legacy_id_key ON tenant_template.production_data USING btree (legacy_id);


--
-- Name: production_data_part_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX production_data_part_id_idx ON tenant_template.production_data USING btree (part_id);


--
-- Name: production_data_work_shift_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX production_data_work_shift_id_idx ON tenant_template.production_data USING btree (work_shift_id);


--
-- Name: salary_group_deleted_at_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX salary_group_deleted_at_idx ON tenant_template.salary_group USING btree (deleted_at);


--
-- Name: salary_group_legacy_id_key; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE UNIQUE INDEX salary_group_legacy_id_key ON tenant_template.salary_group USING btree (legacy_id);


--
-- Name: scrap_data_created_by_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX scrap_data_created_by_idx ON tenant_template.scrap_data USING btree (created_by);


--
-- Name: scrap_data_deleted_at_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX scrap_data_deleted_at_idx ON tenant_template.scrap_data USING btree (deleted_at);


--
-- Name: scrap_data_flow_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX scrap_data_flow_id_idx ON tenant_template.scrap_data USING btree (flow_id);


--
-- Name: scrap_data_flow_id_work_shift_id_date_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX scrap_data_flow_id_work_shift_id_date_idx ON tenant_template.scrap_data USING btree (flow_id, work_shift_id, date);


--
-- Name: scrap_data_flow_object_key_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX scrap_data_flow_object_key_idx ON tenant_template.scrap_data USING btree (flow_object_key);


--
-- Name: scrap_data_legacy_id_key; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE UNIQUE INDEX scrap_data_legacy_id_key ON tenant_template.scrap_data USING btree (legacy_id);


--
-- Name: scrap_data_part_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX scrap_data_part_id_idx ON tenant_template.scrap_data USING btree (part_id);


--
-- Name: scrap_data_reason_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX scrap_data_reason_idx ON tenant_template.scrap_data USING btree (reason);


--
-- Name: scrap_data_scrap_type_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX scrap_data_scrap_type_id_idx ON tenant_template.scrap_data USING btree (scrap_type_id);


--
-- Name: scrap_data_work_shift_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX scrap_data_work_shift_id_idx ON tenant_template.scrap_data USING btree (work_shift_id);


--
-- Name: scrap_reasons_deleted_at_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX scrap_reasons_deleted_at_idx ON tenant_template.scrap_reasons USING btree (deleted_at);


--
-- Name: scrap_reasons_legacy_id_key; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE UNIQUE INDEX scrap_reasons_legacy_id_key ON tenant_template.scrap_reasons USING btree (legacy_id);


--
-- Name: scrap_reasons_type_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX scrap_reasons_type_id_idx ON tenant_template.scrap_reasons USING btree (type_id);


--
-- Name: shift_schedule_data_legacy_id_key; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE UNIQUE INDEX shift_schedule_data_legacy_id_key ON tenant_template.shift_schedule_data USING btree (legacy_id);


--
-- Name: shift_schedule_data_schedule_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX shift_schedule_data_schedule_id_idx ON tenant_template.shift_schedule_data USING btree (schedule_id);


--
-- Name: shift_schedule_data_start_end_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX shift_schedule_data_start_end_idx ON tenant_template.shift_schedule_data USING btree (start, "end");


--
-- Name: shift_schedules_deleted_at_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX shift_schedules_deleted_at_idx ON tenant_template.shift_schedules USING btree (deleted_at);


--
-- Name: shift_schedules_legacy_id_key; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE UNIQUE INDEX shift_schedules_legacy_id_key ON tenant_template.shift_schedules USING btree (legacy_id);


--
-- Name: stop_category_deleted_at_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX stop_category_deleted_at_idx ON tenant_template.stop_category USING btree (deleted_at);


--
-- Name: stop_category_legacy_id_key; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE UNIQUE INDEX stop_category_legacy_id_key ON tenant_template.stop_category USING btree (legacy_id);


--
-- Name: stop_data_created_by_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX stop_data_created_by_idx ON tenant_template.stop_data USING btree (created_by);


--
-- Name: stop_data_deleted_at_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX stop_data_deleted_at_idx ON tenant_template.stop_data USING btree (deleted_at);


--
-- Name: stop_data_flow_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX stop_data_flow_id_idx ON tenant_template.stop_data USING btree (flow_id);


--
-- Name: stop_data_flow_id_work_shift_id_date_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX stop_data_flow_id_work_shift_id_date_idx ON tenant_template.stop_data USING btree (flow_id, work_shift_id, date);


--
-- Name: stop_data_flow_object_key_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX stop_data_flow_object_key_idx ON tenant_template.stop_data USING btree (flow_object_key);


--
-- Name: stop_data_legacy_id_key; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE UNIQUE INDEX stop_data_legacy_id_key ON tenant_template.stop_data USING btree (legacy_id);


--
-- Name: stop_data_machine_stop_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX stop_data_machine_stop_id_idx ON tenant_template.stop_data USING btree (machine_stop_id);


--
-- Name: stop_data_part_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX stop_data_part_id_idx ON tenant_template.stop_data USING btree (part_id);


--
-- Name: stop_data_reason_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX stop_data_reason_idx ON tenant_template.stop_data USING btree (reason);


--
-- Name: stop_data_stop_timestamp_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX stop_data_stop_timestamp_idx ON tenant_template.stop_data USING btree (stop_timestamp);


--
-- Name: stop_data_stop_type_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX stop_data_stop_type_id_idx ON tenant_template.stop_data USING btree (stop_type_id);


--
-- Name: stop_data_work_shift_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX stop_data_work_shift_id_idx ON tenant_template.stop_data USING btree (work_shift_id);


--
-- Name: stop_reasons_deleted_at_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX stop_reasons_deleted_at_idx ON tenant_template.stop_reasons USING btree (deleted_at);


--
-- Name: stop_reasons_legacy_id_key; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE UNIQUE INDEX stop_reasons_legacy_id_key ON tenant_template.stop_reasons USING btree (legacy_id);


--
-- Name: stop_reasons_type_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX stop_reasons_type_id_idx ON tenant_template.stop_reasons USING btree (type_id);


--
-- Name: symbols_legacy_id_key; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE UNIQUE INDEX symbols_legacy_id_key ON tenant_template.symbols USING btree (legacy_id);


--
-- Name: tenant_machines_legacy_id_key; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE UNIQUE INDEX tenant_machines_legacy_id_key ON tenant_template.tenant_machines USING btree (legacy_id);


--
-- Name: tenant_machines_programme_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX tenant_machines_programme_id_idx ON tenant_template.tenant_machines USING btree (programme_id);


--
-- Name: types_deleted_at_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX types_deleted_at_idx ON tenant_template.types USING btree (deleted_at);


--
-- Name: types_entity_is_active_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX types_entity_is_active_idx ON tenant_template.types USING btree (entity, is_active);


--
-- Name: types_legacy_id_key; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE UNIQUE INDEX types_legacy_id_key ON tenant_template.types USING btree (legacy_id);


--
-- Name: user_equipments_equipment_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX user_equipments_equipment_id_idx ON tenant_template.user_equipments USING btree (equipment_id);


--
-- Name: user_equipments_legacy_id_key; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE UNIQUE INDEX user_equipments_legacy_id_key ON tenant_template.user_equipments USING btree (legacy_id);


--
-- Name: user_equipments_user_id_equipment_id_key; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE UNIQUE INDEX user_equipments_user_id_equipment_id_key ON tenant_template.user_equipments USING btree (user_id, equipment_id);


--
-- Name: user_file_locks_legacy_id_key; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE UNIQUE INDEX user_file_locks_legacy_id_key ON tenant_template.user_file_locks USING btree (legacy_id);


--
-- Name: user_file_locks_machine_file_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX user_file_locks_machine_file_id_idx ON tenant_template.user_file_locks USING btree (machine_file_id);


--
-- Name: user_file_locks_machine_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX user_file_locks_machine_id_idx ON tenant_template.user_file_locks USING btree (machine_id);


--
-- Name: user_file_locks_user_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX user_file_locks_user_id_idx ON tenant_template.user_file_locks USING btree (user_id);


--
-- Name: warning_data_equipment_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX warning_data_equipment_id_idx ON tenant_template.warning_data USING btree (equipment_id);


--
-- Name: warning_data_from_time_to_time_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX warning_data_from_time_to_time_idx ON tenant_template.warning_data USING btree (from_time, to_time);


--
-- Name: warning_data_legacy_id_key; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE UNIQUE INDEX warning_data_legacy_id_key ON tenant_template.warning_data USING btree (legacy_id);


--
-- Name: warning_data_machine_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX warning_data_machine_id_idx ON tenant_template.warning_data USING btree (machine_id);


--
-- Name: work_shifts_deleted_at_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX work_shifts_deleted_at_idx ON tenant_template.work_shifts USING btree (deleted_at);


--
-- Name: work_shifts_legacy_id_key; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE UNIQUE INDEX work_shifts_legacy_id_key ON tenant_template.work_shifts USING btree (legacy_id);


--
-- Name: workstations_legacy_id_key; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE UNIQUE INDEX workstations_legacy_id_key ON tenant_template.workstations USING btree (legacy_id);


--
-- Name: workstations_machine_id_idx; Type: INDEX; Schema: tenant_template; Owner: -
--

CREATE INDEX workstations_machine_id_idx ON tenant_template.workstations USING btree (machine_id);


--
-- Name: dashboard_widgets dashboard_widgets_board_id_fkey; Type: FK CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.dashboard_widgets
    ADD CONSTRAINT dashboard_widgets_board_id_fkey FOREIGN KEY (board_id) REFERENCES tenant_template.dashboards(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: equipment_assign equipment_assign_equipment_id_fkey; Type: FK CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.equipment_assign
    ADD CONSTRAINT equipment_assign_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES tenant_template.equipment(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: equipment_orders equipment_orders_equipment_id_fkey; Type: FK CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.equipment_orders
    ADD CONSTRAINT equipment_orders_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES tenant_template.equipment(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: equipment_parts equipment_parts_equipment_id_fkey; Type: FK CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.equipment_parts
    ADD CONSTRAINT equipment_parts_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES tenant_template.equipment(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: equipment_properties equipment_properties_equip_id_fkey; Type: FK CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.equipment_properties
    ADD CONSTRAINT equipment_properties_equip_id_fkey FOREIGN KEY (equip_id) REFERENCES tenant_template.equipment(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: equipment_scrap_reasons equipment_scrap_reasons_equipment_id_fkey; Type: FK CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.equipment_scrap_reasons
    ADD CONSTRAINT equipment_scrap_reasons_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES tenant_template.equipment(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: equipment_scrap_reasons equipment_scrap_reasons_reason_type_id_fkey; Type: FK CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.equipment_scrap_reasons
    ADD CONSTRAINT equipment_scrap_reasons_reason_type_id_fkey FOREIGN KEY (reason_type_id) REFERENCES tenant_template.scrap_reasons(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: equipment_shift_schedule equipment_shift_schedule_equipment_id_fkey; Type: FK CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.equipment_shift_schedule
    ADD CONSTRAINT equipment_shift_schedule_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES tenant_template.equipment(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: equipment_shift_schedule equipment_shift_schedule_schedule_id_fkey; Type: FK CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.equipment_shift_schedule
    ADD CONSTRAINT equipment_shift_schedule_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES tenant_template.shift_schedules(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: equipment_stop_reasons equipment_stop_reasons_equipment_id_fkey; Type: FK CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.equipment_stop_reasons
    ADD CONSTRAINT equipment_stop_reasons_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES tenant_template.equipment(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: equipment_stop_reasons equipment_stop_reasons_reason_type_id_fkey; Type: FK CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.equipment_stop_reasons
    ADD CONSTRAINT equipment_stop_reasons_reason_type_id_fkey FOREIGN KEY (reason_type_id) REFERENCES tenant_template.stop_reasons(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: equipment equipment_type_id_fkey; Type: FK CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.equipment
    ADD CONSTRAINT equipment_type_id_fkey FOREIGN KEY (type_id) REFERENCES tenant_template.types(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: flow_design_attributes flow_design_attributes_flow_design_id_fkey; Type: FK CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.flow_design_attributes
    ADD CONSTRAINT flow_design_attributes_flow_design_id_fkey FOREIGN KEY (flow_design_id) REFERENCES tenant_template.flow_designs(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: folders folders_equipment_id_fkey; Type: FK CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.folders
    ADD CONSTRAINT folders_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES tenant_template.equipment(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: folders folders_folder_type_fkey; Type: FK CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.folders
    ADD CONSTRAINT folders_folder_type_fkey FOREIGN KEY (folder_type) REFERENCES tenant_template.types(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: machine_data machine_data_machine_id_fkey; Type: FK CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.machine_data
    ADD CONSTRAINT machine_data_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES tenant_template.machines(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: machine_document_files machine_document_files_machine_id_fkey; Type: FK CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.machine_document_files
    ADD CONSTRAINT machine_document_files_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES tenant_template.machine_documents(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: machine_documents machine_documents_equipment_id_fkey; Type: FK CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.machine_documents
    ADD CONSTRAINT machine_documents_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES tenant_template.equipment(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: machine_documents machine_documents_folder_id_fkey; Type: FK CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.machine_documents
    ADD CONSTRAINT machine_documents_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES tenant_template.folders(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: machine_previous_starts machine_previous_starts_machine_id_fkey; Type: FK CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.machine_previous_starts
    ADD CONSTRAINT machine_previous_starts_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES tenant_template.machines(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: machine_programme_files machine_programme_files_programme_id_fkey; Type: FK CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.machine_programme_files
    ADD CONSTRAINT machine_programme_files_programme_id_fkey FOREIGN KEY (programme_id) REFERENCES tenant_template.machine_programmes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: machine_status machine_status_machine_id_fkey; Type: FK CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.machine_status
    ADD CONSTRAINT machine_status_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES tenant_template.machines(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: machine_user_settings machine_user_settings_machine_id_fkey; Type: FK CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.machine_user_settings
    ADD CONSTRAINT machine_user_settings_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES tenant_template.machines(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: machines machines_equipment_id_fkey; Type: FK CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.machines
    ADD CONSTRAINT machines_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES tenant_template.equipment(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: orders orders_flow_id_fkey; Type: FK CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.orders
    ADD CONSTRAINT orders_flow_id_fkey FOREIGN KEY (flow_id) REFERENCES tenant_template.flow_designs(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: orders orders_part_id_fkey; Type: FK CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.orders
    ADD CONSTRAINT orders_part_id_fkey FOREIGN KEY (part_id) REFERENCES tenant_template.parts(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: orders orders_type_id_fkey; Type: FK CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.orders
    ADD CONSTRAINT orders_type_id_fkey FOREIGN KEY (type_id) REFERENCES tenant_template.types(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: parts parts_type_id_fkey; Type: FK CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.parts
    ADD CONSTRAINT parts_type_id_fkey FOREIGN KEY (type_id) REFERENCES tenant_template.types(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: production_data production_data_flow_id_fkey; Type: FK CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.production_data
    ADD CONSTRAINT production_data_flow_id_fkey FOREIGN KEY (flow_id) REFERENCES tenant_template.flow_designs(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: production_data production_data_part_id_fkey; Type: FK CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.production_data
    ADD CONSTRAINT production_data_part_id_fkey FOREIGN KEY (part_id) REFERENCES tenant_template.parts(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: production_data production_data_work_shift_id_fkey; Type: FK CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.production_data
    ADD CONSTRAINT production_data_work_shift_id_fkey FOREIGN KEY (work_shift_id) REFERENCES tenant_template.work_shifts(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: scrap_data scrap_data_flow_id_fkey; Type: FK CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.scrap_data
    ADD CONSTRAINT scrap_data_flow_id_fkey FOREIGN KEY (flow_id) REFERENCES tenant_template.flow_designs(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: scrap_data scrap_data_part_id_fkey; Type: FK CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.scrap_data
    ADD CONSTRAINT scrap_data_part_id_fkey FOREIGN KEY (part_id) REFERENCES tenant_template.parts(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: scrap_data scrap_data_reason_fkey; Type: FK CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.scrap_data
    ADD CONSTRAINT scrap_data_reason_fkey FOREIGN KEY (reason) REFERENCES tenant_template.scrap_reasons(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: scrap_data scrap_data_scrap_type_id_fkey; Type: FK CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.scrap_data
    ADD CONSTRAINT scrap_data_scrap_type_id_fkey FOREIGN KEY (scrap_type_id) REFERENCES tenant_template.types(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: scrap_data scrap_data_work_shift_id_fkey; Type: FK CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.scrap_data
    ADD CONSTRAINT scrap_data_work_shift_id_fkey FOREIGN KEY (work_shift_id) REFERENCES tenant_template.work_shifts(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: scrap_reasons scrap_reasons_type_id_fkey; Type: FK CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.scrap_reasons
    ADD CONSTRAINT scrap_reasons_type_id_fkey FOREIGN KEY (type_id) REFERENCES tenant_template.types(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: shift_schedule_data shift_schedule_data_schedule_id_fkey; Type: FK CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.shift_schedule_data
    ADD CONSTRAINT shift_schedule_data_schedule_id_fkey FOREIGN KEY (schedule_id) REFERENCES tenant_template.shift_schedules(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: stop_data stop_data_flow_id_fkey; Type: FK CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.stop_data
    ADD CONSTRAINT stop_data_flow_id_fkey FOREIGN KEY (flow_id) REFERENCES tenant_template.flow_designs(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: stop_data stop_data_part_id_fkey; Type: FK CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.stop_data
    ADD CONSTRAINT stop_data_part_id_fkey FOREIGN KEY (part_id) REFERENCES tenant_template.parts(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: stop_data stop_data_reason_fkey; Type: FK CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.stop_data
    ADD CONSTRAINT stop_data_reason_fkey FOREIGN KEY (reason) REFERENCES tenant_template.stop_reasons(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: stop_data stop_data_stop_type_id_fkey; Type: FK CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.stop_data
    ADD CONSTRAINT stop_data_stop_type_id_fkey FOREIGN KEY (stop_type_id) REFERENCES tenant_template.types(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: stop_data stop_data_work_shift_id_fkey; Type: FK CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.stop_data
    ADD CONSTRAINT stop_data_work_shift_id_fkey FOREIGN KEY (work_shift_id) REFERENCES tenant_template.work_shifts(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: stop_reasons stop_reasons_type_id_fkey; Type: FK CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.stop_reasons
    ADD CONSTRAINT stop_reasons_type_id_fkey FOREIGN KEY (type_id) REFERENCES tenant_template.types(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: tenant_machines tenant_machines_programme_id_fkey; Type: FK CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.tenant_machines
    ADD CONSTRAINT tenant_machines_programme_id_fkey FOREIGN KEY (programme_id) REFERENCES tenant_template.machine_programmes(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_equipments user_equipments_equipment_id_fkey; Type: FK CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.user_equipments
    ADD CONSTRAINT user_equipments_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES tenant_template.equipment(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_file_locks user_file_locks_machine_file_id_fkey; Type: FK CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.user_file_locks
    ADD CONSTRAINT user_file_locks_machine_file_id_fkey FOREIGN KEY (machine_file_id) REFERENCES tenant_template.machine_document_files(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_file_locks user_file_locks_machine_id_fkey; Type: FK CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.user_file_locks
    ADD CONSTRAINT user_file_locks_machine_id_fkey FOREIGN KEY (machine_id) REFERENCES tenant_template.machine_documents(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: warning_data warning_data_equipment_id_fkey; Type: FK CONSTRAINT; Schema: tenant_template; Owner: -
--

ALTER TABLE ONLY tenant_template.warning_data
    ADD CONSTRAINT warning_data_equipment_id_fkey FOREIGN KEY (equipment_id) REFERENCES tenant_template.equipment(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

\unrestrict xVrnbqLtp2OupGPcYORgTldjrJfxzHkvuiz6u2jcLKfgJEyhBv46Zxmrd6JUys7

