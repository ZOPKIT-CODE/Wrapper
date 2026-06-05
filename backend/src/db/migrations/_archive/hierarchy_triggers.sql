-- =============================================================================
-- HIERARCHY MANAGEMENT TRIGGERS
-- =============================================================================
-- These triggers automatically maintain hierarchy_path and full_hierarchy_path
-- when entities are inserted, updated, or deleted
-- =============================================================================

-- Function to build hierarchy path from entity ID chain
CREATE OR REPLACE FUNCTION build_hierarchy_path(entity_id_param uuid)
RETURNS text AS $$
DECLARE
    path_parts text[];
    current_id uuid := entity_id_param;
    current_entity record;
    max_depth integer := 0;
BEGIN
    -- Prevent infinite loops
    WHILE current_id IS NOT NULL AND max_depth < 50 LOOP
        -- Get current entity
        SELECT entity_id, parent_entity_id, entity_name
        INTO current_entity
        FROM entities
        WHERE entity_id = current_id;

        -- If entity not found, break
        IF NOT FOUND THEN
            EXIT;
        END IF;

        -- Prepend entity ID to path
        path_parts := array_prepend(current_entity.entity_id::text, path_parts);

        -- Move to parent
        current_id := current_entity.parent_entity_id;
        max_depth := max_depth + 1;
    END LOOP;

    -- Join path parts with dots
    RETURN array_to_string(path_parts, '.');
END;
$$ LANGUAGE plpgsql;

-- Function to update hierarchy paths for an entity and all its descendants
CREATE OR REPLACE FUNCTION update_entity_hierarchy_paths(entity_id_param uuid)
RETURNS void AS $$
DECLARE
    entity_record record;
    descendant_record record;
BEGIN
    -- Update the entity itself
    UPDATE entities
    SET hierarchy_path = build_hierarchy_path(entity_id_param),
        full_hierarchy_path = (
            SELECT string_agg(e.entity_name, ' > ' ORDER BY array_position(string_to_array(build_hierarchy_path(entity_id_param), '.'), path_part::text))
            FROM unnest(string_to_array(build_hierarchy_path(entity_id_param), '.')) AS path_part
            JOIN entities e ON e.entity_id = path_part::uuid
        )
    WHERE entity_id = entity_id_param;

    -- Update all descendants
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
$$ LANGUAGE plpgsql;

-- Trigger function for INSERT operations
CREATE OR REPLACE FUNCTION trigger_entity_hierarchy_insert()
RETURNS trigger AS $$
BEGIN
    -- Set hierarchy paths for the new entity
    NEW.hierarchy_path := build_hierarchy_path(NEW.entity_id);
    NEW.full_hierarchy_path := (
        SELECT string_agg(e.entity_name, ' > ' ORDER BY array_position(string_to_array(NEW.hierarchy_path, '.'), path_part::text))
        FROM unnest(string_to_array(NEW.hierarchy_path, '.')) AS path_part
        JOIN entities e ON e.entity_id = path_part::uuid
    );

    -- Update entity level based on hierarchy depth
    NEW.entity_level := array_length(string_to_array(NEW.hierarchy_path, '.'), 1);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for UPDATE operations
CREATE OR REPLACE FUNCTION trigger_entity_hierarchy_update()
RETURNS trigger AS $$
BEGIN
    -- If parent changed or this is a new entity, recalculate hierarchy
    IF OLD.parent_entity_id IS DISTINCT FROM NEW.parent_entity_id THEN
        -- Update this entity and all descendants
        PERFORM update_entity_hierarchy_paths(NEW.entity_id);

        -- Refresh NEW with updated values
        SELECT hierarchy_path, full_hierarchy_path, entity_level
        INTO NEW.hierarchy_path, NEW.full_hierarchy_path, NEW.entity_level
        FROM entities
        WHERE entity_id = NEW.entity_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for DELETE operations
CREATE OR REPLACE FUNCTION trigger_entity_hierarchy_delete()
RETURNS trigger AS $$
BEGIN
    -- Update hierarchy paths for all descendants that are now orphaned
    -- This will be handled by the UPDATE trigger when parent_entity_id is set to NULL

    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create the triggers
DROP TRIGGER IF EXISTS trigger_entity_hierarchy_insert ON entities;
DROP TRIGGER IF EXISTS trigger_entity_hierarchy_update ON entities;
DROP TRIGGER IF EXISTS trigger_entity_hierarchy_delete ON entities;

CREATE TRIGGER trigger_entity_hierarchy_insert
    BEFORE INSERT ON entities
    FOR EACH ROW EXECUTE FUNCTION trigger_entity_hierarchy_insert();

CREATE TRIGGER trigger_entity_hierarchy_update
    BEFORE UPDATE ON entities
    FOR EACH ROW EXECUTE FUNCTION trigger_entity_hierarchy_update();

CREATE TRIGGER trigger_entity_hierarchy_delete
    AFTER DELETE ON entities
    FOR EACH ROW EXECUTE FUNCTION trigger_entity_hierarchy_delete();

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to get entity hierarchy tree
CREATE OR REPLACE FUNCTION get_entity_hierarchy(tenant_id_param uuid)
RETURNS TABLE (
    entity_id uuid,
    entity_name text,
    entity_type text,
    entity_level integer,
    hierarchy_path text,
    full_hierarchy_path text,
    parent_entity_id uuid,
    children jsonb
) AS $$
BEGIN
    RETURN QUERY
    WITH RECURSIVE entity_tree AS (
        -- Base case: root entities (no parent)
        SELECT
            e.entity_id,
            e.entity_name,
            e.entity_type,
            e.entity_level,
            e.hierarchy_path,
            e.full_hierarchy_path,
            e.parent_entity_id,
            jsonb_build_array() as children,
            1 as depth
        FROM entities e
        WHERE e.tenant_id = tenant_id_param
          AND e.parent_entity_id IS NULL
          AND e.is_active = true

        UNION ALL

        -- Recursive case: child entities
        SELECT
            e.entity_id,
            e.entity_name,
            e.entity_type,
            e.entity_level,
            e.hierarchy_path,
            e.full_hierarchy_path,
            e.parent_entity_id,
            jsonb_build_array() as children,
            et.depth + 1
        FROM entities e
        JOIN entity_tree et ON e.parent_entity_id = et.entity_id
        WHERE e.tenant_id = tenant_id_param
          AND e.is_active = true
    )
    SELECT
        et.entity_id,
        et.entity_name,
        et.entity_type,
        et.entity_level,
        et.hierarchy_path,
        et.full_hierarchy_path,
        et.parent_entity_id,
        (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'entity_id', child.entity_id,
                    'entity_name', child.entity_name,
                    'entity_type', child.entity_type,
                    'entity_level', child.entity_level,
                    'hierarchy_path', child.hierarchy_path,
                    'parent_entity_id', child.parent_entity_id,
                    'children', child.children
                )
            )
            FROM entity_tree child
            WHERE child.parent_entity_id = et.entity_id
        ) as children
    FROM entity_tree et
    ORDER BY et.entity_level, et.entity_name;
END;
$$ LANGUAGE plpgsql;

-- Function to validate hierarchy integrity (prevent circular references)
CREATE OR REPLACE FUNCTION validate_entity_hierarchy()
RETURNS trigger AS $$
DECLARE
    parent_path text;
BEGIN
    -- Only validate if parent_entity_id is being set
    IF NEW.parent_entity_id IS NOT NULL THEN
        -- Get the hierarchy path of the proposed parent
        SELECT hierarchy_path INTO parent_path
        FROM entities
        WHERE entity_id = NEW.parent_entity_id;

        -- Check if the new entity is already in the parent's hierarchy
        IF parent_path LIKE '%' || NEW.entity_id || '%' THEN
            RAISE EXCEPTION 'Circular reference detected: cannot set parent to a descendant';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create validation trigger
DROP TRIGGER IF EXISTS trigger_validate_entity_hierarchy ON entities;
CREATE TRIGGER trigger_validate_entity_hierarchy
    BEFORE UPDATE ON entities
    FOR EACH ROW
    WHEN (OLD.parent_entity_id IS DISTINCT FROM NEW.parent_entity_id)
    EXECUTE FUNCTION validate_entity_hierarchy();

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Index for hierarchy path queries
CREATE INDEX IF NOT EXISTS idx_entities_hierarchy_path ON entities USING gin (hierarchy_path gin_trgm_ops);

-- Index for parent-child relationships
CREATE INDEX IF NOT EXISTS idx_entities_parent_entity_id ON entities (parent_entity_id);

-- Index for tenant-entity queries
CREATE INDEX IF NOT EXISTS idx_entities_tenant_hierarchy ON entities (tenant_id, parent_entity_id, entity_level);

-- Index for entity type queries
CREATE INDEX IF NOT EXISTS idx_entities_type_hierarchy ON entities (entity_type, tenant_id, parent_entity_id);

-- =============================================================================
-- MIGRATION HELPERS
-- =============================================================================

-- Function to rebuild all hierarchy paths (useful for data migration)
CREATE OR REPLACE FUNCTION rebuild_all_hierarchy_paths()
RETURNS void AS $$
DECLARE
    entity_record record;
BEGIN
    -- Disable triggers temporarily for bulk update
    ALTER TABLE entities DISABLE TRIGGER trigger_entity_hierarchy_update;

    -- Update all entities
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

    -- Re-enable triggers
    ALTER TABLE entities ENABLE TRIGGER trigger_entity_hierarchy_update;

    RAISE NOTICE 'All hierarchy paths rebuilt successfully';
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- COMMENTS AND DOCUMENTATION
-- =============================================================================

COMMENT ON FUNCTION build_hierarchy_path(uuid) IS 'Builds hierarchy path from entity ID chain';
COMMENT ON FUNCTION update_entity_hierarchy_paths(uuid) IS 'Updates hierarchy paths for entity and descendants';
COMMENT ON FUNCTION get_entity_hierarchy(uuid) IS 'Returns complete entity hierarchy tree for a tenant';
COMMENT ON FUNCTION rebuild_all_hierarchy_paths() IS 'Rebuilds all hierarchy paths (for migrations)';

COMMENT ON COLUMN entities.hierarchy_path IS 'Dot-separated list of entity IDs from root to current entity';
COMMENT ON COLUMN entities.full_hierarchy_path IS 'Human-readable hierarchy path with entity names';
COMMENT ON COLUMN entities.entity_level IS 'Depth level in hierarchy (1 = root)';
