--
-- PostgreSQL database dump
--



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: build_hierarchy_path(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.build_hierarchy_path(entity_id_param uuid) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
    path_parts text[];
    current_id uuid := entity_id_param;
    current_entity record;
    max_depth integer := 0;
BEGIN
    WHILE current_id IS NOT NULL AND max_depth < 50 LOOP
        SELECT entity_id, parent_entity_id, entity_name
        INTO current_entity
        FROM entities
        WHERE entity_id = current_id;

        IF NOT FOUND THEN
            EXIT;
        END IF;

        path_parts := array_prepend(current_entity.entity_id::text, path_parts);
        current_id := current_entity.parent_entity_id;
        max_depth := max_depth + 1;
    END LOOP;

    RETURN array_to_string(path_parts, '.');
END;
$$;


--
-- Name: FUNCTION build_hierarchy_path(entity_id_param uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.build_hierarchy_path(entity_id_param uuid) IS 'Builds hierarchy path from entity ID chain';


--
-- Name: get_entity_hierarchy(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_entity_hierarchy(tenant_id_param uuid) RETURNS TABLE(entity_id uuid, entity_name text, entity_type text, entity_level integer, hierarchy_path text, full_hierarchy_path text, parent_entity_id uuid, children jsonb)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE entity_tree AS (
        SELECT
            e.entity_id, e.entity_name, e.entity_type, e.entity_level,
            e.hierarchy_path, e.full_hierarchy_path, e.parent_entity_id,
            jsonb_build_array() as children, 1 as depth
        FROM entities e
        WHERE e.tenant_id = tenant_id_param
          AND e.parent_entity_id IS NULL
          AND e.is_active = true

        UNION ALL

        SELECT
            e.entity_id, e.entity_name, e.entity_type, e.entity_level,
            e.hierarchy_path, e.full_hierarchy_path, e.parent_entity_id,
            jsonb_build_array() as children, et.depth + 1
        FROM entities e
        JOIN entity_tree et ON e.parent_entity_id = et.entity_id
        WHERE e.tenant_id = tenant_id_param
          AND e.is_active = true
    )
    SELECT
        et.entity_id, et.entity_name, et.entity_type, et.entity_level,
        et.hierarchy_path, et.full_hierarchy_path, et.parent_entity_id,
        (
            SELECT jsonb_agg(jsonb_build_object(
                'entity_id', child.entity_id,
                'entity_name', child.entity_name,
                'entity_type', child.entity_type,
                'entity_level', child.entity_level,
                'hierarchy_path', child.hierarchy_path,
                'parent_entity_id', child.parent_entity_id,
                'children', child.children
            ))
            FROM entity_tree child
            WHERE child.parent_entity_id = et.entity_id
        ) as children
    FROM entity_tree et
    ORDER BY et.entity_level, et.entity_name;
END;
$$;


--
-- Name: FUNCTION get_entity_hierarchy(tenant_id_param uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_entity_hierarchy(tenant_id_param uuid) IS 'Returns complete entity hierarchy tree for a tenant';


--
-- Name: rebuild_all_hierarchy_paths(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.rebuild_all_hierarchy_paths() RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    entity_record record;
BEGIN
    ALTER TABLE entities DISABLE TRIGGER trigger_entity_hierarchy_update;

    FOR entity_record IN SELECT entity_id FROM entities ORDER BY entity_level LOOP
        UPDATE entities
        SET hierarchy_path = build_hierarchy_path(entity_record.entity_id),
            full_hierarchy_path = (
                SELECT string_agg(e.entity_name, ' > ' ORDER BY array_position(string_to_array(build_hierarchy_path(entity_record.entity_id), '.'), path_part::text))
                FROM unnest(string_to_array(build_hierarchy_path(entity_record.entity_id), '.')) AS path_part
                JOIN entities e ON e.entity_id = path_part::uuid
            ),
            entity_level = array_length(string_to_array(build_hierarchy_path(entity_record.entity_id), '.'), 1)
        WHERE entity_id = entity_record.entity_id;
    END LOOP;

    ALTER TABLE entities ENABLE TRIGGER trigger_entity_hierarchy_update;
    RAISE NOTICE 'All hierarchy paths rebuilt successfully';
END;
$$;


--
-- Name: FUNCTION rebuild_all_hierarchy_paths(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.rebuild_all_hierarchy_paths() IS 'Rebuilds all hierarchy paths (for migrations)';


--
-- Name: trigger_entity_hierarchy_delete(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_entity_hierarchy_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN OLD;
END;
$$;


--
-- Name: trigger_entity_hierarchy_insert(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_entity_hierarchy_insert() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.hierarchy_path := build_hierarchy_path(NEW.entity_id);
    NEW.full_hierarchy_path := (
        SELECT string_agg(e.entity_name, ' > ' ORDER BY array_position(string_to_array(NEW.hierarchy_path, '.'), path_part::text))
        FROM unnest(string_to_array(NEW.hierarchy_path, '.')) AS path_part
        JOIN entities e ON e.entity_id = path_part::uuid
    );
    NEW.entity_level := array_length(string_to_array(NEW.hierarchy_path, '.'), 1);
    RETURN NEW;
END;
$$;


--
-- Name: trigger_entity_hierarchy_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_entity_hierarchy_update() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF OLD.parent_entity_id IS DISTINCT FROM NEW.parent_entity_id THEN
        PERFORM update_entity_hierarchy_paths(NEW.entity_id);
        SELECT hierarchy_path, full_hierarchy_path, entity_level
        INTO NEW.hierarchy_path, NEW.full_hierarchy_path, NEW.entity_level
        FROM entities
        WHERE entity_id = NEW.entity_id;
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: update_entity_hierarchy_paths(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_entity_hierarchy_paths(entity_id_param uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    descendant_record record;
BEGIN
    UPDATE entities
    SET hierarchy_path = build_hierarchy_path(entity_id_param),
        full_hierarchy_path = (
            SELECT string_agg(e.entity_name, ' > ' ORDER BY array_position(string_to_array(build_hierarchy_path(entity_id_param), '.'), path_part::text))
            FROM unnest(string_to_array(build_hierarchy_path(entity_id_param), '.')) AS path_part
            JOIN entities e ON e.entity_id = path_part::uuid
        )
    WHERE entity_id = entity_id_param;

    FOR descendant_record IN
        SELECT entity_id
        FROM entities
        WHERE hierarchy_path LIKE '%' || entity_id_param || '%'
          AND entity_id != entity_id_param
    LOOP
        UPDATE entities
        SET hierarchy_path = build_hierarchy_path(descendant_record.entity_id),
            full_hierarchy_path = (
                SELECT string_agg(e.entity_name, ' > ' ORDER BY array_position(string_to_array(build_hierarchy_path(descendant_record.entity_id), '.'), path_part::text))
                FROM unnest(string_to_array(build_hierarchy_path(descendant_record.entity_id), '.')) AS path_part
                JOIN entities e ON e.entity_id = path_part::uuid
            )
        WHERE entity_id = descendant_record.entity_id;
    END LOOP;
END;
$$;


--
-- Name: FUNCTION update_entity_hierarchy_paths(entity_id_param uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.update_entity_hierarchy_paths(entity_id_param uuid) IS 'Updates hierarchy paths for entity and descendants';


--
-- Name: validate_entity_hierarchy(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.validate_entity_hierarchy() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    parent_path text;
BEGIN
    IF NEW.parent_entity_id IS NOT NULL THEN
        SELECT hierarchy_path INTO parent_path
        FROM entities
        WHERE entity_id = NEW.parent_entity_id;

        IF parent_path LIKE '%' || NEW.entity_id || '%' THEN
            RAISE EXCEPTION 'Circular reference detected: cannot set parent to a descendant';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


--
--



SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: application_modules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.application_modules (
    module_id uuid DEFAULT gen_random_uuid() NOT NULL,
    app_id uuid,
    module_code character varying(50) NOT NULL,
    module_name character varying(100) NOT NULL,
    description text,
    is_core boolean DEFAULT false,
    permissions jsonb,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.applications (
    app_id uuid DEFAULT gen_random_uuid() NOT NULL,
    app_code character varying(50) NOT NULL,
    app_name character varying(100) NOT NULL,
    description text,
    icon character varying(255),
    base_url character varying(255) NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    version character varying(20),
    is_core boolean DEFAULT false,
    sort_order integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    CONSTRAINT chk_application_status CHECK (((status)::text = ANY (ARRAY[('active'::character varying)::text, ('inactive'::character varying)::text, ('maintenance'::character varying)::text, ('deprecated'::character varying)::text])))
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    log_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    user_id character varying(255),
    organization_id uuid,
    location_id uuid,
    entity_type character varying(20) DEFAULT 'organization'::character varying,
    access_level character varying(20) DEFAULT 'direct'::character varying,
    action character varying(100) NOT NULL,
    resource_type character varying(50) NOT NULL,
    resource_id character varying(255),
    old_values jsonb,
    new_values jsonb,
    details jsonb,
    ip_address character varying(45),
    user_agent text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: blog_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blog_comments (
    comment_id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id uuid NOT NULL,
    author_name character varying(120) NOT NULL,
    author_email character varying(255),
    body text NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    created_ip character varying(64),
    moderated_by uuid,
    moderated_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT blog_comments_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'spam'::character varying])::text[])))
);


--
-- Name: blog_post_links; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blog_post_links (
    from_post_id uuid NOT NULL,
    to_post_id uuid NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT blog_post_links_no_self CHECK ((from_post_id <> to_post_id))
);


--
-- Name: blog_post_slug_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blog_post_slug_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id uuid NOT NULL,
    old_slug character varying(255) NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: blog_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blog_posts (
    post_id uuid DEFAULT gen_random_uuid() NOT NULL,
    author_id uuid,
    title character varying(255) NOT NULL,
    slug character varying(255) NOT NULL,
    subtitle text,
    excerpt text,
    body jsonb NOT NULL,
    body_html text,
    schema_version integer DEFAULT 1 NOT NULL,
    cover_image_key character varying(500),
    cover_image_alt text,
    tags jsonb DEFAULT '[]'::jsonb NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    meta_title text,
    meta_description text,
    og_image_key character varying(500),
    seo_noindex boolean DEFAULT false NOT NULL,
    reading_time_minutes integer,
    word_count integer,
    published_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    created_by uuid,
    updated_by uuid,
    series_id uuid,
    series_position integer,
    CONSTRAINT blog_posts_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'published'::character varying, 'archived'::character varying])::text[])))
);


--
-- Name: blog_series; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blog_series (
    series_id uuid DEFAULT gen_random_uuid() NOT NULL,
    title character varying(255) NOT NULL,
    slug character varying(255) NOT NULL,
    description text,
    cover_image_key character varying(500),
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    deleted_at timestamp without time zone,
    created_by uuid,
    updated_by uuid
);


--
-- Name: circuit_breaker_state; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.circuit_breaker_state (
    name text NOT NULL,
    state text DEFAULT 'closed'::text NOT NULL,
    failures integer DEFAULT 0 NOT NULL,
    last_failure_time bigint DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT circuit_breaker_state_state_check CHECK ((state = ANY (ARRAY['closed'::text, 'open'::text, 'half-open'::text])))
);


--
-- Name: contact_submissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contact_submissions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    company character varying(255),
    phone character varying(50),
    job_title character varying(255),
    company_size character varying(50),
    preferred_time character varying(50),
    comments text,
    source character varying(20) DEFAULT 'contact'::character varying NOT NULL,
    ip character varying(45),
    user_agent text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: credit_batches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_batches (
    allocation_id uuid DEFAULT gen_random_uuid() NOT NULL,
    campaign_id uuid,
    tenant_id uuid NOT NULL,
    entity_id uuid NOT NULL,
    entity_type character varying(50) DEFAULT 'organization'::character varying,
    target_application character varying(50),
    allocated_credits numeric(15,4) NOT NULL,
    used_credits numeric(15,4) DEFAULT '0'::numeric,
    distribution_status character varying(50) DEFAULT 'pending'::character varying,
    distribution_error text,
    is_active boolean DEFAULT true,
    is_expired boolean DEFAULT false,
    allocated_at timestamp without time zone DEFAULT now(),
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    credit_type character varying(20) DEFAULT 'free'::character varying,
    CONSTRAINT credit_batches_credit_type_check CHECK (((credit_type)::text = ANY (ARRAY[('free'::character varying)::text, ('paid'::character varying)::text, ('seasonal'::character varying)::text])))
);


--
-- Name: TABLE credit_batches; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.credit_batches IS 'Tracks individual credit allocations to tenants'' primary organizations. Supports both organization-wide and application-specific allocations';


--
-- Name: COLUMN credit_batches.target_application; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.credit_batches.target_application IS 'NULL = allocated to primary org (all applications can use), specific app code (e.g., crm, hr) = allocated only to that application';


--
-- Name: credit_category_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_category_snapshots (
    snapshot_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    entity_id uuid NOT NULL,
    free_credits numeric(15,4) DEFAULT 0 NOT NULL,
    paid_credits numeric(15,4) DEFAULT 0 NOT NULL,
    seasonal_credits numeric(15,4) DEFAULT 0 NOT NULL,
    free_credits_expiry timestamp with time zone,
    paid_credits_expiry timestamp with time zone,
    seasonal_credits_expiry timestamp with time zone,
    subscription_expiry timestamp with time zone,
    application_expiry_dates jsonb DEFAULT '{}'::jsonb NOT NULL,
    subscription_plan jsonb DEFAULT '"credit_based"'::jsonb NOT NULL,
    computed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: credit_configurations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_configurations (
    config_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    operation_code character varying(255) NOT NULL,
    is_global boolean DEFAULT true,
    credit_cost numeric(10,4) NOT NULL,
    unit character varying(20) DEFAULT 'operation'::character varying,
    unit_multiplier numeric(10,4) DEFAULT '1'::numeric,
    is_active boolean DEFAULT true,
    created_by uuid NOT NULL,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    operation_name character varying(255),
    category character varying(100),
    free_allowance integer,
    free_allowance_period character varying(20),
    volume_tiers jsonb,
    allow_overage boolean DEFAULT false,
    overage_limit integer,
    overage_period character varying(20),
    overage_cost numeric(10,4),
    scope character varying(20) DEFAULT 'global'::character varying,
    priority integer DEFAULT 100,
    CONSTRAINT check_global_consistency CHECK ((((tenant_id IS NULL) AND (is_global = true)) OR ((tenant_id IS NOT NULL) AND (is_global = false))))
);


--
-- Name: credit_expiry_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_expiry_runs (
    run_id uuid DEFAULT gen_random_uuid() NOT NULL,
    ran_at timestamp with time zone DEFAULT now() NOT NULL,
    trigger_source character varying(50) DEFAULT 'cron'::character varying NOT NULL,
    triggered_by uuid,
    batches_processed integer DEFAULT 0 NOT NULL,
    error_count integer DEFAULT 0 NOT NULL,
    duration_ms integer,
    status character varying(20) DEFAULT 'success'::character varying NOT NULL,
    error_message text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: credit_purchases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_purchases (
    purchase_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    entity_id uuid,
    credit_amount numeric(15,4) NOT NULL,
    unit_price numeric(10,4) NOT NULL,
    total_amount numeric(10,2) NOT NULL,
    batch_id uuid NOT NULL,
    expiry_date timestamp with time zone,
    payment_method character varying(50),
    stripe_payment_intent_id character varying(255),
    status character varying(20) DEFAULT 'pending'::character varying,
    requested_at timestamp with time zone DEFAULT now(),
    paid_at timestamp with time zone,
    credited_at timestamp with time zone,
    requested_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chk_credit_purchase_status CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('completed'::character varying)::text, ('failed'::character varying)::text, ('cancelled'::character varying)::text, ('processing'::character varying)::text])))
);


--
-- Name: credit_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credit_transactions (
    transaction_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    entity_id uuid,
    transaction_type character varying(30) NOT NULL,
    amount numeric(15,4) NOT NULL,
    previous_balance numeric(15,4),
    new_balance numeric(15,4),
    operation_code character varying(255),
    initiated_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chk_credit_transaction_type CHECK (((transaction_type)::text = ANY (ARRAY[('purchase'::character varying)::text, ('consumption'::character varying)::text, ('expiry'::character varying)::text, ('adjustment'::character varying)::text, ('transfer'::character varying)::text, ('initialization'::character varying)::text, ('allocation'::character varying)::text, ('transfer_in'::character varying)::text, ('transfer_out'::character varying)::text])))
);


--
-- Name: credits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.credits (
    credit_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    entity_id uuid NOT NULL,
    available_credits numeric(15,4) DEFAULT '0'::numeric NOT NULL,
    is_active boolean DEFAULT true,
    last_updated_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chk_credits_non_negative CHECK ((available_credits >= (0)::numeric))
);


--
-- Name: custom_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.custom_roles (
    role_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    organization_id uuid,
    location_id uuid,
    scope character varying(20) DEFAULT 'organization'::character varying,
    is_inheritable boolean DEFAULT true,
    parent_role_id uuid,
    role_name character varying(100) NOT NULL,
    description text,
    color character varying(7) DEFAULT '#6b7280'::character varying,
    idp_role_id character varying(255),
    idp_role_key character varying(255),
    permissions jsonb NOT NULL,
    restrictions jsonb DEFAULT '{}'::jsonb,
    is_system_role boolean DEFAULT false,
    is_default boolean DEFAULT false,
    priority integer DEFAULT 0,
    created_by uuid NOT NULL,
    last_modified_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chk_org_id_matches_tenant_id CHECK (((organization_id IS NULL) OR (organization_id = tenant_id)))
);


--
-- Name: entities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.entities (
    entity_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    entity_type character varying(20) NOT NULL,
    parent_entity_id uuid,
    entity_level integer DEFAULT 1,
    entity_name character varying(255) NOT NULL,
    description text,
    location_type character varying(20),
    department_type character varying(20),
    team_type character varying(20),
    address jsonb,
    timezone character varying(50) DEFAULT 'Asia/Kolkata'::character varying,
    currency character varying(3) DEFAULT 'INR'::character varying,
    language character varying(10) DEFAULT 'en'::character varying,
    responsible_person_id uuid,
    inherit_credits boolean DEFAULT false,
    settings jsonb DEFAULT '{"features": {}, "autoBackup": true, "notifications": true}'::jsonb,
    is_active boolean DEFAULT true,
    hierarchy_path text,
    full_hierarchy_path text,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    contact_email character varying(255),
    contact_phone character varying(50),
    legal_name character varying(255),
    country character varying(3),
    fiscal_year_end character varying(10) DEFAULT '12-31'::character varying,
    tax_id character varying(50),
    registration_number character varying(100),
    contact_website character varying(500),
    CONSTRAINT chk_entity_type CHECK (((entity_type)::text = ANY (ARRAY[('organization'::character varying)::text, ('location'::character varying)::text, ('department'::character varying)::text, ('team'::character varying)::text])))
);


--
-- Name: event_tracking; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.event_tracking (
    event_id text NOT NULL,
    event_type text NOT NULL,
    tenant_id uuid NOT NULL,
    entity_id uuid,
    stream_key text NOT NULL,
    event_data jsonb,
    published_at timestamp with time zone DEFAULT now() NOT NULL,
    published_by text,
    acknowledged boolean DEFAULT false NOT NULL,
    acknowledged_at timestamp with time zone,
    status text DEFAULT 'published'::text NOT NULL,
    error_message text,
    retry_count integer DEFAULT 0 NOT NULL,
    last_retry_at timestamp with time zone,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    source_application character varying(50) NOT NULL,
    target_application character varying(50) NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    is_retryable boolean DEFAULT true
);


--
-- Name: TABLE event_tracking; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.event_tracking IS 'Tracks events published to external systems and their acknowledgment status';


--
-- Name: COLUMN event_tracking.event_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.event_tracking.event_id IS 'Unique event identifier from the publishing system';


--
-- Name: COLUMN event_tracking.event_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.event_tracking.event_type IS 'Type of event (credit.allocated, credit.consumed, etc.)';


--
-- Name: COLUMN event_tracking.tenant_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.event_tracking.tenant_id IS 'Tenant that owns the event';


--
-- Name: COLUMN event_tracking.entity_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.event_tracking.entity_id IS 'Associated entity (organization, user, etc.)';


--
-- Name: COLUMN event_tracking.stream_key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.event_tracking.stream_key IS 'Redis stream key where event was published';


--
-- Name: COLUMN event_tracking.event_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.event_tracking.event_data IS 'Original event payload data';


--
-- Name: COLUMN event_tracking.acknowledged; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.event_tracking.acknowledged IS 'Whether the event has been acknowledged by the receiving system';


--
-- Name: COLUMN event_tracking.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.event_tracking.status IS 'Current status: published, acknowledged, failed, timeout';


--
-- Name: COLUMN event_tracking.retry_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.event_tracking.retry_count IS 'Number of retry attempts';


--
-- Name: COLUMN event_tracking.metadata; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.event_tracking.metadata IS 'Additional context and metadata';


--
-- Name: COLUMN event_tracking.source_application; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.event_tracking.source_application IS 'Application that published the event (wrapper, crm, hr, affiliate, system)';


--
-- Name: COLUMN event_tracking.target_application; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.event_tracking.target_application IS 'Application that should process the event (wrapper, crm, hr, affiliate, system)';


--
-- Name: inter_app_outbox; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inter_app_outbox (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id text NOT NULL,
    event_type text NOT NULL,
    target_application text NOT NULL,
    payload jsonb NOT NULL,
    message_attributes jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    published_at timestamp with time zone,
    attempt_count integer DEFAULT 0 NOT NULL,
    last_attempt_at timestamp with time zone,
    last_error text
);


--
-- Name: notification_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_templates (
    template_id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    category text DEFAULT 'custom'::text NOT NULL,
    description text,
    type text NOT NULL,
    priority text DEFAULT 'medium'::text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    action_url text,
    action_label text,
    variables jsonb DEFAULT '{}'::jsonb,
    metadata jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    version text DEFAULT '1.0.0'::text,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    last_used_at timestamp without time zone,
    ui_config jsonb DEFAULT '{"gap": "12px", "shadow": "md", "padding": "16px", "textColor": "#111827", "buttonSize": "sm", "fontFamily": "system-ui, -apple-system, sans-serif", "titleColor": "#111827", "accentColor": "#3b82f6", "borderColor": "#d1d5db", "borderWidth": "0px", "buttonStyle": "outline", "hoverEffect": true, "borderRadius": "6px", "buttonHeight": "32px", "messageColor": "#1f2937", "buttonPadding": "12px", "showSeparator": true, "showTimestamp": true, "titleFontSize": "16px", "buttonFontSize": "12px", "readTitleColor": "#374151", "separatorColor": "#f3f4f6", "timestampColor": "#6b7280", "backgroundColor": "#ffffff", "borderLeftWidth": "4px", "messageFontSize": "14px", "priorityBorders": {"low": "#86efac", "high": "#fcd34d", "medium": "#93c5fd", "urgent": "#fca5a5"}, "titleFontWeight": "600", "titleLineHeight": "1.25", "buttonFontWeight": "500", "priorityIconSize": "16px", "readMessageColor": "#4b5563", "showPriorityIcon": true, "unreadTitleColor": "#111827", "messageFontWeight": "400", "messageLineHeight": "1.75", "showActionButtons": true, "showTypeIndicator": true, "timestampFontSize": "12px", "typeIndicatorSize": "8px", "separatorMarginTop": "16px", "transitionDuration": "200ms", "unreadMessageColor": "#1f2937", "priorityBackgrounds": {"low": "#f0fdf4", "high": "#fffbeb", "medium": "#eff6ff", "urgent": "#fef2f2"}, "separatorPaddingTop": "12px", "timestampFontWeight": "500", "typeIndicatorColors": {"default": "#6b7280", "plan_upgrade": "#a855f7", "system_update": "#6366f1", "security_alert": "#ef4444", "billing_reminder": "#dc2626", "purchase_success": "#3b82f6", "seasonal_credits": "#10b981", "feature_announcement": "#ec4899", "credit_expiry_warning": "#f97316", "maintenance_scheduled": "#eab308"}, "typeIndicatorLabelSize": "12px", "typeIndicatorLabelColor": "#6b7280", "typeIndicatorLabelWeight": "500"}'::jsonb
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    notification_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    type text NOT NULL,
    priority text DEFAULT 'medium'::text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    action_url text,
    action_label text,
    metadata jsonb,
    is_read boolean DEFAULT false NOT NULL,
    is_dismissed boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone,
    scheduled_at timestamp with time zone,
    target_user_id uuid
);


--
-- Name: onboarding_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.onboarding_events (
    event_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    event_type character varying(100) NOT NULL,
    event_action character varying(50) NOT NULL,
    user_id uuid,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: onboarding_form_data; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.onboarding_form_data (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    idp_sub character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    current_step character varying(50),
    flow_type character varying(50),
    form_data jsonb DEFAULT '{}'::jsonb NOT NULL,
    step_data jsonb DEFAULT '{}'::jsonb,
    last_saved timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE onboarding_form_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.onboarding_form_data IS 'Stores onboarding form data before user/tenant records are created';


--
-- Name: COLUMN onboarding_form_data.idp_sub; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.onboarding_form_data.idp_sub IS 'Kinde authentication user ID';


--
-- Name: COLUMN onboarding_form_data.email; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.onboarding_form_data.email IS 'User email address';


--
-- Name: COLUMN onboarding_form_data.form_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.onboarding_form_data.form_data IS 'Complete form data as JSON';


--
-- Name: COLUMN onboarding_form_data.step_data; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.onboarding_form_data.step_data IS 'Step-specific data for progress tracking';


--
-- Name: organization_applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid,
    app_id uuid,
    is_enabled boolean DEFAULT true,
    enabled_modules jsonb,
    custom_permissions jsonb,
    license_count integer DEFAULT 0,
    max_users integer,
    subscription_tier character varying(50),
    expires_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: organization_memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_memberships (
    membership_id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    tenant_id uuid NOT NULL,
    entity_id uuid NOT NULL,
    entity_type character varying(20) DEFAULT 'organization'::character varying,
    role_id uuid,
    membership_type character varying(20) DEFAULT 'direct'::character varying,
    membership_status character varying(20) DEFAULT 'active'::character varying,
    access_level character varying(20) DEFAULT 'standard'::character varying,
    is_primary boolean DEFAULT false,
    can_access_sub_entities boolean DEFAULT false,
    is_temporary boolean DEFAULT false,
    valid_from timestamp without time zone,
    valid_until timestamp without time zone,
    timezone character varying(50) DEFAULT 'Asia/Kolkata'::character varying,
    invited_by uuid,
    invited_at timestamp without time zone,
    joined_at timestamp without time zone,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_by uuid NOT NULL,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT chk_membership_status CHECK (((membership_status)::text = ANY (ARRAY[('active'::character varying)::text, ('inactive'::character varying)::text, ('suspended'::character varying)::text, ('pending'::character varying)::text, ('invited'::character varying)::text]))),
    CONSTRAINT chk_org_membership_entity_type CHECK (((entity_type)::text = ANY (ARRAY[('organization'::character varying)::text, ('location'::character varying)::text, ('department'::character varying)::text, ('team'::character varying)::text])))
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    payment_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    subscription_id uuid,
    stripe_payment_intent_id character varying(255),
    stripe_invoice_id character varying(255),
    stripe_charge_id character varying(255),
    amount numeric(10,2) NOT NULL,
    currency character varying(3) DEFAULT 'USD'::character varying,
    status character varying(20) NOT NULL,
    payment_method character varying(50),
    payment_method_details jsonb DEFAULT '{}'::jsonb,
    payment_type character varying(30) DEFAULT 'subscription'::character varying,
    billing_reason character varying(50),
    invoice_number character varying(50),
    description text,
    tax_amount numeric(10,2) DEFAULT '0'::numeric,
    metadata jsonb DEFAULT '{}'::jsonb,
    stripe_raw_data jsonb DEFAULT '{}'::jsonb,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    amount_refunded numeric(10,2) DEFAULT 0,
    refund_reason character varying(100),
    is_partial_refund boolean DEFAULT false,
    refunded_at timestamp with time zone,
    provider character varying(20) DEFAULT 'stripe'::character varying,
    CONSTRAINT chk_payment_status CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'completed'::character varying, 'succeeded'::character varying, 'failed'::character varying, 'cancelled'::character varying, 'canceled'::character varying, 'refunded'::character varying, 'partially_refunded'::character varying, 'disputed'::character varying])::text[])))
);


--
-- Name: platform_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_audit_logs (
    audit_id uuid DEFAULT gen_random_uuid() NOT NULL,
    staff_id uuid NOT NULL,
    idp_sub character varying(255) NOT NULL,
    staff_email character varying(255) NOT NULL,
    action character varying(100) NOT NULL,
    target_tenant_id uuid NOT NULL,
    target_resource character varying(100) NOT NULL,
    target_resource_id character varying(255),
    request_path character varying(500) NOT NULL,
    request_method character varying(10) NOT NULL,
    changes_before text,
    changes_after text,
    ip_address character varying(45),
    user_agent text,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: platform_staff; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_staff (
    staff_id uuid DEFAULT gen_random_uuid() NOT NULL,
    idp_sub character varying(255) NOT NULL,
    email character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    granted_permissions text[] NOT NULL,
    granted_by uuid,
    granted_at timestamp without time zone DEFAULT now() NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    reason text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    revoked_by uuid,
    revoked_at timestamp without time zone,
    revoked_reason text,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: received_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.received_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    event_id text NOT NULL,
    event_type text NOT NULL,
    source_application text NOT NULL,
    target_application text NOT NULL,
    tenant_id uuid,
    entity_id text,
    correlation_id text,
    causation_id text,
    schema_version text,
    payload jsonb NOT NULL,
    raw_envelope jsonb NOT NULL,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    handler_status text DEFAULT 'pending'::text NOT NULL,
    handler_error text,
    processed_at timestamp with time zone,
    receive_count integer DEFAULT 1 NOT NULL,
    sqs_message_id text
);


--
-- Name: responsible_persons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.responsible_persons (
    assignment_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    entity_type character varying(20) NOT NULL,
    entity_id uuid,
    user_id uuid NOT NULL,
    responsibility_level character varying(20) DEFAULT 'primary'::character varying,
    scope jsonb DEFAULT '{}'::jsonb,
    auto_permissions jsonb DEFAULT '{}'::jsonb,
    assigned_by uuid NOT NULL,
    assigned_at timestamp with time zone DEFAULT now(),
    assignment_reason text,
    is_temporary boolean DEFAULT false,
    valid_from timestamp with time zone,
    valid_until timestamp with time zone,
    is_active boolean DEFAULT true,
    is_confirmed boolean DEFAULT false,
    confirmed_at timestamp with time zone,
    can_delegate boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: seasonal_credit_campaigns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.seasonal_credit_campaigns (
    campaign_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    campaign_name character varying(255) NOT NULL,
    credit_type character varying(50) NOT NULL,
    description text,
    total_credits numeric(15,4) NOT NULL,
    credits_per_tenant numeric(15,4),
    distribution_method character varying(50) DEFAULT 'equal'::character varying,
    target_all_tenants boolean DEFAULT false,
    target_tenant_ids uuid[],
    target_applications jsonb DEFAULT '["crm", "hr", "affiliate", "system"]'::jsonb,
    distribution_status character varying(50) DEFAULT 'pending'::character varying,
    distributed_count integer DEFAULT 0,
    failed_count integer DEFAULT 0,
    starts_at timestamp without time zone DEFAULT now(),
    expires_at timestamp with time zone NOT NULL,
    distributed_at timestamp without time zone,
    is_active boolean DEFAULT true,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    metadata jsonb,
    send_notifications boolean DEFAULT true,
    notification_template text
);


--
-- Name: TABLE seasonal_credit_campaigns; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.seasonal_credit_campaigns IS 'Stores campaign metadata for distributing free credits to tenants';


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    subscription_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    plan character varying(50) NOT NULL,
    status character varying(20) NOT NULL,
    stripe_subscription_id character varying(255),
    stripe_customer_id character varying(255),
    is_trial_user boolean DEFAULT false,
    has_ever_upgraded boolean DEFAULT false,
    billing_cycle character varying(20) DEFAULT 'monthly'::character varying,
    yearly_price numeric(10,2) DEFAULT '0'::numeric,
    current_period_start timestamp with time zone,
    current_period_end timestamp with time zone,
    cancel_at timestamp with time zone,
    canceled_at timestamp with time zone,
    suspended_at timestamp with time zone,
    suspended_reason text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    trial_started_at timestamp with time zone,
    trial_ends_at timestamp with time zone,
    CONSTRAINT chk_subscription_status CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying, 'trialing'::character varying, 'trial'::character varying, 'past_due'::character varying, 'canceled'::character varying, 'cancelled'::character varying, 'paused'::character varying, 'suspended'::character varying])::text[])))
);


--
-- Name: tenant_banking_details; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_banking_details (
    banking_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    bank_name character varying(255),
    bank_branch character varying(255),
    account_holder_name character varying(255),
    account_number character varying(50),
    account_type character varying(50),
    bank_account_currency character varying(3),
    swift_bic_code character varying(11),
    iban character varying(34),
    routing_number_us character varying(9),
    sort_code_uk character varying(6),
    ifsc_code_india character varying(11),
    bsb_number_australia character varying(6),
    payment_terms character varying(50),
    preferred_payment_method character varying(50),
    credit_limit numeric(15,2),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: tenant_invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_invitations (
    invitation_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    email character varying(255) NOT NULL,
    role_id uuid,
    invited_by uuid NOT NULL,
    invitation_token character varying(255) NOT NULL,
    invitation_url character varying(1000),
    status character varying(20) DEFAULT 'pending'::character varying,
    expires_at timestamp with time zone NOT NULL,
    accepted_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    cancelled_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    target_entities jsonb DEFAULT '[]'::jsonb,
    invitation_scope character varying(20) DEFAULT 'tenant'::character varying,
    primary_entity_id uuid,
    CONSTRAINT chk_invitation_scope CHECK (((invitation_scope)::text = ANY (ARRAY[('tenant'::character varying)::text, ('single-entity'::character varying)::text, ('multi-entity'::character varying)::text]))),
    CONSTRAINT chk_invitation_status CHECK (((status)::text = ANY (ARRAY[('pending'::character varying)::text, ('accepted'::character varying)::text, ('expired'::character varying)::text, ('cancelled'::character varying)::text, ('revoked'::character varying)::text])))
);


--
-- Name: COLUMN tenant_invitations.target_entities; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenant_invitations.target_entities IS 'Array of target entities with their roles: [{entityId, roleId, entityType, membershipType}]';


--
-- Name: COLUMN tenant_invitations.invitation_scope; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenant_invitations.invitation_scope IS 'Scope of invitation: tenant, organization, location, multi-entity';


--
-- Name: COLUMN tenant_invitations.primary_entity_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenant_invitations.primary_entity_id IS 'User primary organization/location entity ID';


--
-- Name: tenant_template_customizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_template_customizations (
    customization_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    template_id uuid NOT NULL,
    ui_config jsonb NOT NULL,
    logo_url text,
    brand_colors jsonb DEFAULT '{"accent": null, "primary": null, "secondary": null}'::jsonb,
    is_active boolean DEFAULT true NOT NULL,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


--
-- Name: tenant_users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenant_users (
    user_id uuid DEFAULT gen_random_uuid() NOT NULL,
    tenant_id uuid NOT NULL,
    idp_sub character varying(255),
    email character varying(255) NOT NULL,
    first_name character varying(100),
    last_name character varying(100),
    phone character varying(50),
    primary_organization_id uuid,
    is_responsible_person boolean DEFAULT false,
    is_active boolean DEFAULT true,
    is_verified boolean DEFAULT false,
    is_tenant_admin boolean DEFAULT false,
    invited_at timestamp with time zone,
    last_active_at timestamp with time zone,
    preferences jsonb DEFAULT '{}'::jsonb,
    onboarding_completed boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: tenants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tenants (
    tenant_id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_name character varying(255) NOT NULL,
    subdomain character varying(100) NOT NULL,
    idp_org_id character varying(255) NOT NULL,
    admin_email character varying(255) NOT NULL,
    legal_company_name character varying(255),
    gstin character varying(15),
    company_type character varying(100),
    industry character varying(100),
    website character varying(500),
    billing_street character varying(255),
    billing_city character varying(100),
    billing_state character varying(100),
    billing_zip character varying(20),
    billing_country character varying(100),
    phone character varying(50),
    default_language character varying(10) DEFAULT 'en'::character varying,
    default_locale character varying(20) DEFAULT 'en-IN'::character varying,
    default_currency character varying(3) DEFAULT 'INR'::character varying,
    default_timezone character varying(50) DEFAULT 'Asia/Kolkata'::character varying,
    logo_url character varying(500),
    primary_color character varying(7) DEFAULT '#2563eb'::character varying,
    custom_domain character varying(255),
    branding_config jsonb DEFAULT '{}'::jsonb,
    is_active boolean DEFAULT true,
    is_verified boolean DEFAULT false,
    settings jsonb DEFAULT '{}'::jsonb,
    stripe_customer_id character varying(255),
    onboarding_completed boolean DEFAULT false,
    onboarded_at timestamp without time zone,
    onboarding_started_at timestamp without time zone,
    first_login_at timestamp without time zone,
    last_activity_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    tax_registered boolean DEFAULT false,
    vat_gst_registered boolean DEFAULT false,
    tax_registration_details jsonb DEFAULT '{}'::jsonb,
    organization_size character varying(50),
    billing_email character varying(255),
    contact_job_title character varying(150),
    preferred_contact_method character varying(20),
    mailing_address_same_as_registered boolean DEFAULT true,
    mailing_street character varying(255),
    mailing_city character varying(100),
    mailing_state character varying(100),
    mailing_zip character varying(20),
    mailing_country character varying(100),
    support_email character varying(255),
    contact_salutation character varying(20),
    contact_middle_name character varying(100),
    contact_department character varying(100),
    contact_direct_phone character varying(50),
    contact_mobile_phone character varying(50),
    contact_preferred_contact_method character varying(20),
    contact_authority_level character varying(50),
    fiscal_year_start_month integer DEFAULT 1,
    fiscal_year_end_month integer DEFAULT 12,
    fiscal_year_start_day integer DEFAULT 1,
    fiscal_year_end_day integer DEFAULT 31
);


--
-- Name: COLUMN tenants.tax_registered; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.tax_registered IS 'Whether organization is tax registered';


--
-- Name: COLUMN tenants.vat_gst_registered; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.vat_gst_registered IS 'Whether organization has VAT/GST registration';


--
-- Name: COLUMN tenants.tax_registration_details; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.tax_registration_details IS 'Country-specific tax IDs and details (PAN, EIN, VAT, CIN, etc.)';


--
-- Name: COLUMN tenants.organization_size; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.organization_size IS 'Company size (1-10, 11-50, 51-200, 201-500, 501-1000, 1000+)';


--
-- Name: COLUMN tenants.billing_email; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.billing_email IS 'Separate billing email address';


--
-- Name: COLUMN tenants.contact_job_title; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.contact_job_title IS 'Primary contact person''s job title';


--
-- Name: COLUMN tenants.preferred_contact_method; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.preferred_contact_method IS 'Preferred contact method (email, phone, sms)';


--
-- Name: COLUMN tenants.mailing_address_same_as_registered; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.mailing_address_same_as_registered IS 'Whether mailing address is same as registered address';


--
-- Name: COLUMN tenants.mailing_street; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.mailing_street IS 'Mailing street address';


--
-- Name: COLUMN tenants.mailing_city; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.mailing_city IS 'Mailing city';


--
-- Name: COLUMN tenants.mailing_state; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.mailing_state IS 'Mailing state/province';


--
-- Name: COLUMN tenants.mailing_zip; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.mailing_zip IS 'Mailing ZIP/postal code';


--
-- Name: COLUMN tenants.mailing_country; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.mailing_country IS 'Mailing country';


--
-- Name: COLUMN tenants.support_email; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.support_email IS 'Support email address';


--
-- Name: COLUMN tenants.contact_salutation; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.contact_salutation IS 'Contact salutation (Mr., Mrs., Ms., Dr., Prof.)';


--
-- Name: COLUMN tenants.contact_middle_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.contact_middle_name IS 'Contact middle name';


--
-- Name: COLUMN tenants.contact_department; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.contact_department IS 'Contact department';


--
-- Name: COLUMN tenants.contact_direct_phone; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.contact_direct_phone IS 'Contact direct phone number';


--
-- Name: COLUMN tenants.contact_mobile_phone; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.contact_mobile_phone IS 'Contact mobile phone number';


--
-- Name: COLUMN tenants.contact_preferred_contact_method; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.contact_preferred_contact_method IS 'Contact''s preferred contact method';


--
-- Name: COLUMN tenants.contact_authority_level; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.contact_authority_level IS 'Contact authority level (Owner/Founder, CEO, CFO, CTO, Director, Manager, Administrator, Other)';


--
-- Name: COLUMN tenants.fiscal_year_start_month; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.fiscal_year_start_month IS 'Fiscal year start month (1-12)';


--
-- Name: COLUMN tenants.fiscal_year_end_month; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.fiscal_year_end_month IS 'Fiscal year end month (1-12)';


--
-- Name: COLUMN tenants.fiscal_year_start_day; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.fiscal_year_start_day IS 'Fiscal year start day (1-31)';


--
-- Name: COLUMN tenants.fiscal_year_end_day; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.tenants.fiscal_year_end_day IS 'Fiscal year end day (1-31)';


--
-- Name: user_role_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_role_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role_id uuid NOT NULL,
    organization_id uuid,
    location_id uuid,
    scope character varying(20) DEFAULT 'organization'::character varying,
    is_responsible_person boolean DEFAULT false,
    inherited_from uuid,
    assigned_by uuid NOT NULL,
    assigned_at timestamp without time zone DEFAULT now(),
    is_temporary boolean DEFAULT false,
    expires_at timestamp without time zone,
    is_active boolean DEFAULT true,
    deactivated_at timestamp without time zone,
    deactivated_by uuid
);


--
-- Name: application_modules application_modules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_modules
    ADD CONSTRAINT application_modules_pkey PRIMARY KEY (module_id);


--
-- Name: applications applications_app_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_app_code_unique UNIQUE (app_code);


--
-- Name: applications applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.applications
    ADD CONSTRAINT applications_pkey PRIMARY KEY (app_id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (log_id);


--
-- Name: blog_comments blog_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_comments
    ADD CONSTRAINT blog_comments_pkey PRIMARY KEY (comment_id);


--
-- Name: blog_post_links blog_post_links_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_post_links
    ADD CONSTRAINT blog_post_links_pkey PRIMARY KEY (from_post_id, to_post_id);


--
-- Name: blog_post_slug_history blog_post_slug_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_post_slug_history
    ADD CONSTRAINT blog_post_slug_history_pkey PRIMARY KEY (id);


--
-- Name: blog_posts blog_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_pkey PRIMARY KEY (post_id);


--
-- Name: blog_series blog_series_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_series
    ADD CONSTRAINT blog_series_pkey PRIMARY KEY (series_id);


--
-- Name: circuit_breaker_state circuit_breaker_state_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.circuit_breaker_state
    ADD CONSTRAINT circuit_breaker_state_pkey PRIMARY KEY (name);


--
-- Name: contact_submissions contact_submissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contact_submissions
    ADD CONSTRAINT contact_submissions_pkey PRIMARY KEY (id);


--
-- Name: credit_category_snapshots credit_category_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_category_snapshots
    ADD CONSTRAINT credit_category_snapshots_pkey PRIMARY KEY (snapshot_id);


--
-- Name: credit_configurations credit_configurations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_configurations
    ADD CONSTRAINT credit_configurations_pkey PRIMARY KEY (config_id);


--
-- Name: credit_expiry_runs credit_expiry_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_expiry_runs
    ADD CONSTRAINT credit_expiry_runs_pkey PRIMARY KEY (run_id);


--
-- Name: credit_purchases credit_purchases_batch_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_purchases
    ADD CONSTRAINT credit_purchases_batch_id_unique UNIQUE (batch_id);


--
-- Name: credit_purchases credit_purchases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_purchases
    ADD CONSTRAINT credit_purchases_pkey PRIMARY KEY (purchase_id);


--
-- Name: credit_transactions credit_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_transactions
    ADD CONSTRAINT credit_transactions_pkey PRIMARY KEY (transaction_id);


--
-- Name: credits credits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credits
    ADD CONSTRAINT credits_pkey PRIMARY KEY (credit_id);


--
-- Name: custom_roles custom_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_roles
    ADD CONSTRAINT custom_roles_pkey PRIMARY KEY (role_id);


--
-- Name: entities entities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entities
    ADD CONSTRAINT entities_pkey PRIMARY KEY (entity_id);


--
-- Name: event_tracking event_tracking_event_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.event_tracking
    ADD CONSTRAINT event_tracking_event_id_key UNIQUE (event_id);


--
-- Name: inter_app_outbox inter_app_outbox_event_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inter_app_outbox
    ADD CONSTRAINT inter_app_outbox_event_id_unique UNIQUE (event_id);


--
-- Name: inter_app_outbox inter_app_outbox_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inter_app_outbox
    ADD CONSTRAINT inter_app_outbox_pkey PRIMARY KEY (id);


--
-- Name: notification_templates notification_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_templates
    ADD CONSTRAINT notification_templates_pkey PRIMARY KEY (template_id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (notification_id);


--
-- Name: onboarding_events onboarding_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_events
    ADD CONSTRAINT onboarding_events_pkey PRIMARY KEY (event_id);


--
-- Name: onboarding_form_data onboarding_form_data_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_form_data
    ADD CONSTRAINT onboarding_form_data_pkey PRIMARY KEY (id);


--
-- Name: organization_applications organization_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_applications
    ADD CONSTRAINT organization_applications_pkey PRIMARY KEY (id);


--
-- Name: organization_memberships organization_memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_memberships
    ADD CONSTRAINT organization_memberships_pkey PRIMARY KEY (membership_id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (payment_id);


--
-- Name: platform_audit_logs platform_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_audit_logs
    ADD CONSTRAINT platform_audit_logs_pkey PRIMARY KEY (audit_id);


--
-- Name: platform_staff platform_staff_kinde_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_staff
    ADD CONSTRAINT platform_staff_kinde_user_id_key UNIQUE (idp_sub);


--
-- Name: platform_staff platform_staff_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_staff
    ADD CONSTRAINT platform_staff_pkey PRIMARY KEY (staff_id);


--
-- Name: received_events received_events_event_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.received_events
    ADD CONSTRAINT received_events_event_id_key UNIQUE (event_id);


--
-- Name: received_events received_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.received_events
    ADD CONSTRAINT received_events_pkey PRIMARY KEY (id);


--
-- Name: responsible_persons responsible_persons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.responsible_persons
    ADD CONSTRAINT responsible_persons_pkey PRIMARY KEY (assignment_id);


--
-- Name: credit_batches seasonal_credit_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_batches
    ADD CONSTRAINT seasonal_credit_allocations_pkey PRIMARY KEY (allocation_id);


--
-- Name: seasonal_credit_campaigns seasonal_credit_campaigns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seasonal_credit_campaigns
    ADD CONSTRAINT seasonal_credit_campaigns_pkey PRIMARY KEY (campaign_id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (subscription_id);


--
-- Name: tenant_banking_details tenant_banking_details_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_banking_details
    ADD CONSTRAINT tenant_banking_details_pkey PRIMARY KEY (banking_id);


--
-- Name: tenant_invitations tenant_invitations_invitation_token_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_invitations
    ADD CONSTRAINT tenant_invitations_invitation_token_unique UNIQUE (invitation_token);


--
-- Name: tenant_invitations tenant_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_invitations
    ADD CONSTRAINT tenant_invitations_pkey PRIMARY KEY (invitation_id);


--
-- Name: tenant_template_customizations tenant_template_customizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_template_customizations
    ADD CONSTRAINT tenant_template_customizations_pkey PRIMARY KEY (customization_id);


--
-- Name: tenant_template_customizations tenant_template_customizations_tenant_template_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_template_customizations
    ADD CONSTRAINT tenant_template_customizations_tenant_template_unique UNIQUE (tenant_id, template_id);


--
-- Name: tenant_users tenant_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_users
    ADD CONSTRAINT tenant_users_pkey PRIMARY KEY (user_id);


--
-- Name: tenants tenants_kinde_org_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_kinde_org_id_unique UNIQUE (idp_org_id);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (tenant_id);


--
-- Name: tenants tenants_subdomain_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_subdomain_unique UNIQUE (subdomain);


--
-- Name: credit_category_snapshots uq_credit_snapshot_tenant_entity; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_category_snapshots
    ADD CONSTRAINT uq_credit_snapshot_tenant_entity UNIQUE (tenant_id, entity_id);


--
-- Name: credits uq_credits_tenant_entity; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credits
    ADD CONSTRAINT uq_credits_tenant_entity UNIQUE (tenant_id, entity_id);


--
-- Name: credit_batches uq_seasonal_alloc_campaign_tenant_app; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_batches
    ADD CONSTRAINT uq_seasonal_alloc_campaign_tenant_app UNIQUE (campaign_id, tenant_id, target_application);


--
-- Name: user_role_assignments user_role_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role_assignments
    ADD CONSTRAINT user_role_assignments_pkey PRIMARY KEY (id);


--
-- Name: event_tracking_acknowledged_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX event_tracking_acknowledged_idx ON public.event_tracking USING btree (acknowledged, target_application, created_at DESC) WHERE (acknowledged = false);


--
-- Name: event_tracking_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX event_tracking_created_at_idx ON public.event_tracking USING btree (created_at);


--
-- Name: event_tracking_event_type_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX event_tracking_event_type_idx ON public.event_tracking USING btree (event_type);


--
-- Name: event_tracking_published_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX event_tracking_published_at_idx ON public.event_tracking USING btree (published_at);


--
-- Name: event_tracking_replay_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX event_tracking_replay_idx ON public.event_tracking USING btree (status, retry_count, published_at) WHERE (status = ANY (ARRAY['pending'::text, 'failed'::text]));


--
-- Name: event_tracking_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX event_tracking_status_idx ON public.event_tracking USING btree (status);


--
-- Name: event_tracking_target_app_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX event_tracking_target_app_idx ON public.event_tracking USING btree (target_application, status) WHERE (status = ANY (ARRAY['pending'::text, 'failed'::text]));


--
-- Name: idx_audit_logs_tenant_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_tenant_created_at ON public.audit_logs USING btree (tenant_id, created_at DESC);


--
-- Name: idx_audit_logs_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_tenant_id ON public.audit_logs USING btree (tenant_id);


--
-- Name: idx_blog_comments_post_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blog_comments_post_status ON public.blog_comments USING btree (post_id, status);


--
-- Name: idx_blog_comments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blog_comments_status ON public.blog_comments USING btree (status);


--
-- Name: idx_blog_post_links_to; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blog_post_links_to ON public.blog_post_links USING btree (to_post_id);


--
-- Name: idx_blog_post_slug_history_old_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blog_post_slug_history_old_slug ON public.blog_post_slug_history USING btree (old_slug);


--
-- Name: idx_blog_post_slug_history_post; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blog_post_slug_history_post ON public.blog_post_slug_history USING btree (post_id);


--
-- Name: idx_blog_posts_feed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blog_posts_feed ON public.blog_posts USING btree (status, published_at);


--
-- Name: idx_blog_posts_series; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blog_posts_series ON public.blog_posts USING btree (series_id, series_position);


--
-- Name: idx_blog_posts_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_blog_posts_status ON public.blog_posts USING btree (status);


--
-- Name: idx_contact_submissions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_submissions_created_at ON public.contact_submissions USING btree (created_at);


--
-- Name: idx_contact_submissions_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_submissions_email ON public.contact_submissions USING btree (email);


--
-- Name: idx_contact_submissions_email_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_submissions_email_source ON public.contact_submissions USING btree (email, source);


--
-- Name: idx_contact_submissions_source; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_contact_submissions_source ON public.contact_submissions USING btree (source);


--
-- Name: idx_credit_batches_campaign; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_batches_campaign ON public.credit_batches USING btree (campaign_id);


--
-- Name: idx_credit_batches_expiry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_batches_expiry ON public.credit_batches USING btree (expires_at, is_active, is_expired) WHERE ((is_active = true) AND (is_expired = false));


--
-- Name: idx_credit_batches_expiry_app; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_batches_expiry_app ON public.credit_batches USING btree (expires_at, target_application, is_active, is_expired) WHERE ((is_active = true) AND (is_expired = false));


--
-- Name: idx_credit_batches_target_app; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_batches_target_app ON public.credit_batches USING btree (target_application) WHERE (target_application IS NOT NULL);


--
-- Name: idx_credit_batches_tenant_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_batches_tenant_entity ON public.credit_batches USING btree (tenant_id, entity_id);


--
-- Name: idx_credit_config_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_config_lookup ON public.credit_configurations USING btree (tenant_id, operation_code, is_active);


--
-- Name: idx_credit_snapshots_computed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_snapshots_computed_at ON public.credit_category_snapshots USING btree (computed_at);


--
-- Name: idx_credit_snapshots_tenant_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_snapshots_tenant_entity ON public.credit_category_snapshots USING btree (tenant_id, entity_id);


--
-- Name: idx_credit_transactions_tenant_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_credit_transactions_tenant_entity ON public.credit_transactions USING btree (tenant_id, entity_id, created_at DESC);


--
-- Name: idx_custom_roles_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_custom_roles_tenant_id ON public.custom_roles USING btree (tenant_id);


--
-- Name: idx_entities_hierarchy_path; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entities_hierarchy_path ON public.entities USING btree (hierarchy_path);


--
-- Name: idx_entities_parent_entity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entities_parent_entity_id ON public.entities USING btree (parent_entity_id);


--
-- Name: idx_entities_tenant_hierarchy; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entities_tenant_hierarchy ON public.entities USING btree (tenant_id, parent_entity_id, entity_level);


--
-- Name: idx_entities_type_hierarchy; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entities_type_hierarchy ON public.entities USING btree (entity_type, tenant_id, parent_entity_id);


--
-- Name: idx_event_tracking_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_tracking_tenant_id ON public.event_tracking USING btree (tenant_id);


--
-- Name: idx_event_tracking_tenant_type_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_event_tracking_tenant_type_created ON public.event_tracking USING btree (tenant_id, event_type, created_at DESC);


--
-- Name: idx_expiry_runs_ran_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_expiry_runs_ran_at ON public.credit_expiry_runs USING btree (ran_at DESC);


--
-- Name: idx_inter_app_outbox_unpublished; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_inter_app_outbox_unpublished ON public.inter_app_outbox USING btree (created_at) WHERE (published_at IS NULL);


--
-- Name: idx_notification_templates_category_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_templates_category_active ON public.notification_templates USING btree (category, is_active, created_at DESC);


--
-- Name: idx_notification_templates_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_templates_created_at ON public.notification_templates USING btree (created_at DESC);


--
-- Name: idx_notification_templates_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_templates_created_by ON public.notification_templates USING btree (created_by);


--
-- Name: idx_notification_templates_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_templates_is_active ON public.notification_templates USING btree (is_active);


--
-- Name: idx_notification_templates_type_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notification_templates_type_active ON public.notification_templates USING btree (type, is_active, created_at DESC);


--
-- Name: idx_notifications_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_created_at ON public.notifications USING btree (created_at);


--
-- Name: idx_notifications_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_expires_at ON public.notifications USING btree (expires_at);


--
-- Name: idx_notifications_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_is_active ON public.notifications USING btree (is_active);


--
-- Name: idx_notifications_is_dismissed; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_is_dismissed ON public.notifications USING btree (is_dismissed);


--
-- Name: idx_notifications_is_read; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_is_read ON public.notifications USING btree (is_read);


--
-- Name: idx_notifications_list; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_list ON public.notifications USING btree (tenant_id, is_active, is_dismissed, created_at DESC);


--
-- Name: idx_notifications_priority; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_priority ON public.notifications USING btree (priority);


--
-- Name: idx_notifications_scheduled_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_scheduled_at ON public.notifications USING btree (scheduled_at);


--
-- Name: idx_notifications_target_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_target_user_id ON public.notifications USING btree (target_user_id);


--
-- Name: idx_notifications_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_tenant_id ON public.notifications USING btree (tenant_id);


--
-- Name: idx_notifications_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_type ON public.notifications USING btree (type);


--
-- Name: idx_onboarding_form_data_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_onboarding_form_data_email ON public.onboarding_form_data USING btree (email);


--
-- Name: idx_onboarding_form_data_idp_sub; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_onboarding_form_data_idp_sub ON public.onboarding_form_data USING btree (idp_sub);


--
-- Name: idx_onboarding_form_data_idp_sub_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_onboarding_form_data_idp_sub_email ON public.onboarding_form_data USING btree (idp_sub, email);


--
-- Name: idx_org_memberships_entity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_memberships_entity_id ON public.organization_memberships USING btree (entity_id);


--
-- Name: idx_org_memberships_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_memberships_tenant_id ON public.organization_memberships USING btree (tenant_id);


--
-- Name: idx_org_memberships_user_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_memberships_user_entity ON public.organization_memberships USING btree (user_id, entity_id, membership_status);


--
-- Name: idx_org_memberships_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_memberships_user_id ON public.organization_memberships USING btree (user_id);


--
-- Name: idx_payments_stripe_payment_intent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_stripe_payment_intent ON public.payments USING btree (stripe_payment_intent_id) WHERE (stripe_payment_intent_id IS NOT NULL);


--
-- Name: idx_payments_subscription_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_subscription_id ON public.payments USING btree (subscription_id) WHERE (subscription_id IS NOT NULL);


--
-- Name: idx_payments_tenant_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_tenant_created_at ON public.payments USING btree (tenant_id, created_at DESC);


--
-- Name: idx_payments_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payments_tenant_id ON public.payments USING btree (tenant_id);


--
-- Name: idx_platform_audit_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_platform_audit_action ON public.platform_audit_logs USING btree (action);


--
-- Name: idx_platform_audit_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_platform_audit_created_at ON public.platform_audit_logs USING btree (created_at DESC);


--
-- Name: idx_platform_audit_staff_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_platform_audit_staff_id ON public.platform_audit_logs USING btree (staff_id);


--
-- Name: idx_platform_audit_target_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_platform_audit_target_tenant ON public.platform_audit_logs USING btree (target_tenant_id);


--
-- Name: idx_platform_staff_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_platform_staff_active ON public.platform_staff USING btree (is_active, expires_at);


--
-- Name: idx_platform_staff_idp_sub; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_platform_staff_idp_sub ON public.platform_staff USING btree (idp_sub);


--
-- Name: idx_received_events_received_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_received_events_received_at ON public.received_events USING btree (received_at DESC);


--
-- Name: idx_received_events_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_received_events_status ON public.received_events USING btree (handler_status) WHERE (handler_status <> 'processed'::text);


--
-- Name: idx_received_events_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_received_events_tenant ON public.received_events USING btree (tenant_id);


--
-- Name: idx_received_events_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_received_events_type ON public.received_events USING btree (event_type);


--
-- Name: idx_seasonal_campaigns_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_seasonal_campaigns_status ON public.seasonal_credit_campaigns USING btree (distribution_status, is_active);


--
-- Name: idx_seasonal_campaigns_tenant; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_seasonal_campaigns_tenant ON public.seasonal_credit_campaigns USING btree (tenant_id);


--
-- Name: idx_subscriptions_stripe_sub_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_stripe_sub_id ON public.subscriptions USING btree (stripe_subscription_id) WHERE (stripe_subscription_id IS NOT NULL);


--
-- Name: idx_subscriptions_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_tenant_id ON public.subscriptions USING btree (tenant_id);


--
-- Name: idx_subscriptions_tenant_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_tenant_status ON public.subscriptions USING btree (tenant_id, status);


--
-- Name: idx_subscriptions_trial_ends_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_trial_ends_at ON public.subscriptions USING btree (trial_ends_at) WHERE (trial_ends_at IS NOT NULL);


--
-- Name: idx_tenant_banking_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_tenant_banking_tenant_id ON public.tenant_banking_details USING btree (tenant_id);


--
-- Name: idx_tenant_invitations_pending_multi; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenant_invitations_pending_multi ON public.tenant_invitations USING btree (invitation_token, expires_at) WHERE (((status)::text = 'pending'::text) AND ((invitation_scope)::text = 'multi-entity'::text));


--
-- Name: idx_tenant_invitations_primary_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenant_invitations_primary_entity ON public.tenant_invitations USING btree (primary_entity_id);


--
-- Name: idx_tenant_invitations_scope; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenant_invitations_scope ON public.tenant_invitations USING btree (invitation_scope);


--
-- Name: idx_tenant_template_customizations_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenant_template_customizations_is_active ON public.tenant_template_customizations USING btree (is_active);


--
-- Name: idx_tenant_template_customizations_template_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenant_template_customizations_template_id ON public.tenant_template_customizations USING btree (template_id);


--
-- Name: idx_tenant_template_customizations_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenant_template_customizations_tenant_id ON public.tenant_template_customizations USING btree (tenant_id);


--
-- Name: idx_tenant_template_customizations_tenant_template; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenant_template_customizations_tenant_template ON public.tenant_template_customizations USING btree (tenant_id, template_id);


--
-- Name: idx_tenant_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenant_users_email ON public.tenant_users USING btree (email);


--
-- Name: idx_tenant_users_idp_sub; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenant_users_idp_sub ON public.tenant_users USING btree (idp_sub);


--
-- Name: idx_tenant_users_tenant_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenant_users_tenant_id ON public.tenant_users USING btree (tenant_id);


--
-- Name: idx_tenants_admin_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenants_admin_email ON public.tenants USING btree (admin_email);


--
-- Name: idx_tenants_kinde_org_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenants_kinde_org_id ON public.tenants USING btree (idp_org_id);


--
-- Name: idx_tenants_stripe_customer_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tenants_stripe_customer_id ON public.tenants USING btree (stripe_customer_id);


--
-- Name: organization_applications_tenant_app_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX organization_applications_tenant_app_unique ON public.organization_applications USING btree (tenant_id, app_id);


--
-- Name: unique_credit_config; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unique_credit_config ON public.credit_configurations USING btree (tenant_id, operation_code);


--
-- Name: unique_global_credit_config; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unique_global_credit_config ON public.credit_configurations USING btree (operation_code) WHERE (tenant_id IS NULL);


--
-- Name: unique_tenant_credit_config; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX unique_tenant_credit_config ON public.credit_configurations USING btree (tenant_id, operation_code) WHERE (tenant_id IS NOT NULL);


--
-- Name: uq_blog_posts_pub_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_blog_posts_pub_slug ON public.blog_posts USING btree (slug) WHERE (deleted_at IS NULL);


--
-- Name: uq_blog_series_pub_slug; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_blog_series_pub_slug ON public.blog_series USING btree (slug) WHERE (deleted_at IS NULL);


--
-- Name: entities trigger_entity_hierarchy_delete; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_entity_hierarchy_delete AFTER DELETE ON public.entities FOR EACH ROW EXECUTE FUNCTION public.trigger_entity_hierarchy_delete();


--
-- Name: entities trigger_entity_hierarchy_insert; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_entity_hierarchy_insert BEFORE INSERT ON public.entities FOR EACH ROW EXECUTE FUNCTION public.trigger_entity_hierarchy_insert();


--
-- Name: entities trigger_entity_hierarchy_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_entity_hierarchy_update BEFORE UPDATE ON public.entities FOR EACH ROW EXECUTE FUNCTION public.trigger_entity_hierarchy_update();


--
-- Name: entities trigger_validate_entity_hierarchy; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_validate_entity_hierarchy BEFORE UPDATE ON public.entities FOR EACH ROW WHEN ((old.parent_entity_id IS DISTINCT FROM new.parent_entity_id)) EXECUTE FUNCTION public.validate_entity_hierarchy();


--
-- Name: application_modules application_modules_app_id_applications_app_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.application_modules
    ADD CONSTRAINT application_modules_app_id_applications_app_id_fk FOREIGN KEY (app_id) REFERENCES public.applications(app_id);


--
-- Name: audit_logs audit_logs_organization_id_tenants_tenant_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_organization_id_tenants_tenant_id_fk FOREIGN KEY (organization_id) REFERENCES public.tenants(tenant_id);


--
-- Name: audit_logs audit_logs_tenant_id_tenants_tenant_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_tenant_id_tenants_tenant_id_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id);


--
-- Name: blog_comments blog_comments_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_comments
    ADD CONSTRAINT blog_comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.blog_posts(post_id);


--
-- Name: blog_post_links blog_post_links_from_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_post_links
    ADD CONSTRAINT blog_post_links_from_post_id_fkey FOREIGN KEY (from_post_id) REFERENCES public.blog_posts(post_id) ON DELETE CASCADE;


--
-- Name: blog_post_links blog_post_links_to_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_post_links
    ADD CONSTRAINT blog_post_links_to_post_id_fkey FOREIGN KEY (to_post_id) REFERENCES public.blog_posts(post_id) ON DELETE CASCADE;


--
-- Name: blog_post_slug_history blog_post_slug_history_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_post_slug_history
    ADD CONSTRAINT blog_post_slug_history_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.blog_posts(post_id) ON DELETE CASCADE;


--
-- Name: blog_posts blog_posts_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.tenant_users(user_id);


--
-- Name: blog_posts blog_posts_series_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_series_id_fkey FOREIGN KEY (series_id) REFERENCES public.blog_series(series_id);


--
-- Name: credit_category_snapshots credit_category_snapshots_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_category_snapshots
    ADD CONSTRAINT credit_category_snapshots_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.entities(entity_id);


--
-- Name: credit_category_snapshots credit_category_snapshots_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_category_snapshots
    ADD CONSTRAINT credit_category_snapshots_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id);


--
-- Name: credit_configurations credit_configurations_created_by_tenant_users_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_configurations
    ADD CONSTRAINT credit_configurations_created_by_tenant_users_user_id_fk FOREIGN KEY (created_by) REFERENCES public.tenant_users(user_id);


--
-- Name: credit_configurations credit_configurations_tenant_id_tenants_tenant_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_configurations
    ADD CONSTRAINT credit_configurations_tenant_id_tenants_tenant_id_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id);


--
-- Name: credit_configurations credit_configurations_updated_by_tenant_users_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_configurations
    ADD CONSTRAINT credit_configurations_updated_by_tenant_users_user_id_fk FOREIGN KEY (updated_by) REFERENCES public.tenant_users(user_id);


--
-- Name: credit_purchases credit_purchases_entity_id_entities_entity_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_purchases
    ADD CONSTRAINT credit_purchases_entity_id_entities_entity_id_fk FOREIGN KEY (entity_id) REFERENCES public.entities(entity_id);


--
-- Name: credit_purchases credit_purchases_requested_by_tenant_users_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_purchases
    ADD CONSTRAINT credit_purchases_requested_by_tenant_users_user_id_fk FOREIGN KEY (requested_by) REFERENCES public.tenant_users(user_id);


--
-- Name: credit_purchases credit_purchases_tenant_id_tenants_tenant_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_purchases
    ADD CONSTRAINT credit_purchases_tenant_id_tenants_tenant_id_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id);


--
-- Name: credit_transactions credit_transactions_entity_id_entities_entity_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_transactions
    ADD CONSTRAINT credit_transactions_entity_id_entities_entity_id_fk FOREIGN KEY (entity_id) REFERENCES public.entities(entity_id);


--
-- Name: credit_transactions credit_transactions_initiated_by_tenant_users_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_transactions
    ADD CONSTRAINT credit_transactions_initiated_by_tenant_users_user_id_fk FOREIGN KEY (initiated_by) REFERENCES public.tenant_users(user_id);


--
-- Name: credit_transactions credit_transactions_tenant_id_tenants_tenant_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_transactions
    ADD CONSTRAINT credit_transactions_tenant_id_tenants_tenant_id_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id);


--
-- Name: credits credits_entity_id_entities_entity_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credits
    ADD CONSTRAINT credits_entity_id_entities_entity_id_fk FOREIGN KEY (entity_id) REFERENCES public.entities(entity_id);


--
-- Name: credits credits_tenant_id_tenants_tenant_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credits
    ADD CONSTRAINT credits_tenant_id_tenants_tenant_id_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id);


--
-- Name: custom_roles custom_roles_created_by_tenant_users_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_roles
    ADD CONSTRAINT custom_roles_created_by_tenant_users_user_id_fk FOREIGN KEY (created_by) REFERENCES public.tenant_users(user_id);


--
-- Name: custom_roles custom_roles_last_modified_by_tenant_users_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_roles
    ADD CONSTRAINT custom_roles_last_modified_by_tenant_users_user_id_fk FOREIGN KEY (last_modified_by) REFERENCES public.tenant_users(user_id);


--
-- Name: custom_roles custom_roles_organization_id_tenants_tenant_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_roles
    ADD CONSTRAINT custom_roles_organization_id_tenants_tenant_id_fk FOREIGN KEY (organization_id) REFERENCES public.tenants(tenant_id);


--
-- Name: custom_roles custom_roles_parent_role_id_custom_roles_role_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_roles
    ADD CONSTRAINT custom_roles_parent_role_id_custom_roles_role_id_fk FOREIGN KEY (parent_role_id) REFERENCES public.custom_roles(role_id);


--
-- Name: custom_roles custom_roles_tenant_id_tenants_tenant_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.custom_roles
    ADD CONSTRAINT custom_roles_tenant_id_tenants_tenant_id_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id);


--
-- Name: entities entities_tenant_id_tenants_tenant_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entities
    ADD CONSTRAINT entities_tenant_id_tenants_tenant_id_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id);


--
-- Name: notification_templates notification_templates_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_templates
    ADD CONSTRAINT notification_templates_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.tenant_users(user_id);


--
-- Name: notification_templates notification_templates_created_by_tenant_users_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_templates
    ADD CONSTRAINT notification_templates_created_by_tenant_users_user_id_fk FOREIGN KEY (created_by) REFERENCES public.tenant_users(user_id);


--
-- Name: notifications notifications_tenant_id_tenants_tenant_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_tenant_id_tenants_tenant_id_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id);


--
-- Name: onboarding_events onboarding_events_tenant_id_tenants_tenant_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.onboarding_events
    ADD CONSTRAINT onboarding_events_tenant_id_tenants_tenant_id_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id);


--
-- Name: organization_applications organization_applications_app_id_applications_app_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_applications
    ADD CONSTRAINT organization_applications_app_id_applications_app_id_fk FOREIGN KEY (app_id) REFERENCES public.applications(app_id);


--
-- Name: organization_applications organization_applications_tenant_id_tenants_tenant_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_applications
    ADD CONSTRAINT organization_applications_tenant_id_tenants_tenant_id_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id);


--
-- Name: organization_memberships organization_memberships_created_by_tenant_users_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_memberships
    ADD CONSTRAINT organization_memberships_created_by_tenant_users_user_id_fk FOREIGN KEY (created_by) REFERENCES public.tenant_users(user_id);


--
-- Name: organization_memberships organization_memberships_entity_id_entities_entity_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_memberships
    ADD CONSTRAINT organization_memberships_entity_id_entities_entity_id_fk FOREIGN KEY (entity_id) REFERENCES public.entities(entity_id);


--
-- Name: organization_memberships organization_memberships_invited_by_tenant_users_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_memberships
    ADD CONSTRAINT organization_memberships_invited_by_tenant_users_user_id_fk FOREIGN KEY (invited_by) REFERENCES public.tenant_users(user_id);


--
-- Name: organization_memberships organization_memberships_role_id_custom_roles_role_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_memberships
    ADD CONSTRAINT organization_memberships_role_id_custom_roles_role_id_fk FOREIGN KEY (role_id) REFERENCES public.custom_roles(role_id);


--
-- Name: organization_memberships organization_memberships_tenant_id_tenants_tenant_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_memberships
    ADD CONSTRAINT organization_memberships_tenant_id_tenants_tenant_id_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id);


--
-- Name: organization_memberships organization_memberships_updated_by_tenant_users_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_memberships
    ADD CONSTRAINT organization_memberships_updated_by_tenant_users_user_id_fk FOREIGN KEY (updated_by) REFERENCES public.tenant_users(user_id);


--
-- Name: organization_memberships organization_memberships_user_id_tenant_users_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_memberships
    ADD CONSTRAINT organization_memberships_user_id_tenant_users_user_id_fk FOREIGN KEY (user_id) REFERENCES public.tenant_users(user_id) ON DELETE CASCADE;


--
-- Name: payments payments_subscription_id_subscriptions_subscription_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_subscription_id_subscriptions_subscription_id_fk FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(subscription_id);


--
-- Name: payments payments_tenant_id_tenants_tenant_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_tenant_id_tenants_tenant_id_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id);


--
-- Name: platform_audit_logs platform_audit_logs_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_audit_logs
    ADD CONSTRAINT platform_audit_logs_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.platform_staff(staff_id);


--
-- Name: responsible_persons responsible_persons_assigned_by_tenant_users_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.responsible_persons
    ADD CONSTRAINT responsible_persons_assigned_by_tenant_users_user_id_fk FOREIGN KEY (assigned_by) REFERENCES public.tenant_users(user_id);


--
-- Name: responsible_persons responsible_persons_tenant_id_tenants_tenant_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.responsible_persons
    ADD CONSTRAINT responsible_persons_tenant_id_tenants_tenant_id_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id);


--
-- Name: responsible_persons responsible_persons_user_id_tenant_users_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.responsible_persons
    ADD CONSTRAINT responsible_persons_user_id_tenant_users_user_id_fk FOREIGN KEY (user_id) REFERENCES public.tenant_users(user_id);


--
-- Name: credit_batches seasonal_credit_allocations_campaign_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_batches
    ADD CONSTRAINT seasonal_credit_allocations_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.seasonal_credit_campaigns(campaign_id);


--
-- Name: credit_batches seasonal_credit_allocations_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_batches
    ADD CONSTRAINT seasonal_credit_allocations_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.entities(entity_id);


--
-- Name: credit_batches seasonal_credit_allocations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.credit_batches
    ADD CONSTRAINT seasonal_credit_allocations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id);


--
-- Name: seasonal_credit_campaigns seasonal_credit_campaigns_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seasonal_credit_campaigns
    ADD CONSTRAINT seasonal_credit_campaigns_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.tenant_users(user_id);


--
-- Name: seasonal_credit_campaigns seasonal_credit_campaigns_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seasonal_credit_campaigns
    ADD CONSTRAINT seasonal_credit_campaigns_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id);


--
-- Name: subscriptions subscriptions_tenant_id_tenants_tenant_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_tenant_id_tenants_tenant_id_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id);


--
-- Name: tenant_banking_details tenant_banking_details_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_banking_details
    ADD CONSTRAINT tenant_banking_details_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id) ON DELETE CASCADE;


--
-- Name: tenant_invitations tenant_invitations_primary_entity_id_entities_entity_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_invitations
    ADD CONSTRAINT tenant_invitations_primary_entity_id_entities_entity_id_fk FOREIGN KEY (primary_entity_id) REFERENCES public.entities(entity_id);


--
-- Name: tenant_invitations tenant_invitations_tenant_id_tenants_tenant_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_invitations
    ADD CONSTRAINT tenant_invitations_tenant_id_tenants_tenant_id_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id);


--
-- Name: tenant_template_customizations tenant_template_customizations_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_template_customizations
    ADD CONSTRAINT tenant_template_customizations_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.tenant_users(user_id);


--
-- Name: tenant_template_customizations tenant_template_customizations_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_template_customizations
    ADD CONSTRAINT tenant_template_customizations_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.notification_templates(template_id);


--
-- Name: tenant_template_customizations tenant_template_customizations_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_template_customizations
    ADD CONSTRAINT tenant_template_customizations_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id);


--
-- Name: tenant_users tenant_users_primary_organization_id_entities_entity_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_users
    ADD CONSTRAINT tenant_users_primary_organization_id_entities_entity_id_fk FOREIGN KEY (primary_organization_id) REFERENCES public.entities(entity_id);


--
-- Name: tenant_users tenant_users_tenant_id_tenants_tenant_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tenant_users
    ADD CONSTRAINT tenant_users_tenant_id_tenants_tenant_id_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(tenant_id);


--
-- Name: user_role_assignments user_role_assignments_assigned_by_tenant_users_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role_assignments
    ADD CONSTRAINT user_role_assignments_assigned_by_tenant_users_user_id_fk FOREIGN KEY (assigned_by) REFERENCES public.tenant_users(user_id);


--
-- Name: user_role_assignments user_role_assignments_deactivated_by_tenant_users_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role_assignments
    ADD CONSTRAINT user_role_assignments_deactivated_by_tenant_users_user_id_fk FOREIGN KEY (deactivated_by) REFERENCES public.tenant_users(user_id);


--
-- Name: user_role_assignments user_role_assignments_inherited_from_user_role_assignments_id_f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role_assignments
    ADD CONSTRAINT user_role_assignments_inherited_from_user_role_assignments_id_f FOREIGN KEY (inherited_from) REFERENCES public.user_role_assignments(id);


--
-- Name: user_role_assignments user_role_assignments_organization_id_tenants_tenant_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role_assignments
    ADD CONSTRAINT user_role_assignments_organization_id_tenants_tenant_id_fk FOREIGN KEY (organization_id) REFERENCES public.tenants(tenant_id);


--
-- Name: user_role_assignments user_role_assignments_role_id_custom_roles_role_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role_assignments
    ADD CONSTRAINT user_role_assignments_role_id_custom_roles_role_id_fk FOREIGN KEY (role_id) REFERENCES public.custom_roles(role_id) ON DELETE CASCADE;


--
-- Name: user_role_assignments user_role_assignments_user_id_tenant_users_user_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_role_assignments
    ADD CONSTRAINT user_role_assignments_user_id_tenant_users_user_id_fk FOREIGN KEY (user_id) REFERENCES public.tenant_users(user_id);


--
-- PostgreSQL database dump complete
--


