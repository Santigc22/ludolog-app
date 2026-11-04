-- ============================================================================
-- LUDOTECA VIRTUAL
-- ERD lógico detallado - PostgreSQL
-- Baseline: 2026-09-16 (v1.1)
--
-- Objetivo:
--   - Servir como fuente para importar en herramientas ERD que acepten DDL SQL.
--   - Definir tablas, tipos, obligatoriedad, PK/FK, UNIQUE y CHECK principales.
--   - NO representa todavía la migración productiva final.
--
-- Convenciones:
--   - Las PK de entidades principales son UUID, pero este archivo no fija cómo
--     se generan. La migración productiva podrá usar gen_random_uuid().
--   - Los catálogos estructurales usan VARCHAR como PK legible.
--   - "Archived" / estados de ciclo de vida se prefieren sobre hard-delete para
--     información con valor histórico.
-- ============================================================================


-- ============================================================================
-- 1. CATÁLOGOS ESTRUCTURALES / LOOKUPS
-- ============================================================================
-- En estos catálogos, code es el identificador estable que consumen la API y
-- las reglas de negocio; name es la etiqueta legible que puede mostrarse o
-- traducirse sin romper referencias.

CREATE TABLE user_statuses (
    code VARCHAR(30) PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE visibility_levels (
    code VARCHAR(30) PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE moderation_statuses (
    code VARCHAR(40) PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE game_classifications (
    code VARCHAR(30) PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE group_roles (
    code VARCHAR(30) PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE collection_roles (
    code VARCHAR(30) PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE copy_lifecycle_statuses (
    code VARCHAR(30) PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE copy_exit_reasons (
    code VARCHAR(30) PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE copy_condition_statuses (
    code VARCHAR(30) PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE acquisition_types (
    code VARCHAR(30) PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE game_relation_types (
    code VARCHAR(40) PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE resource_types (
    code VARCHAR(40) PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE game_person_roles (
    code VARCHAR(30) PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE publisher_relation_types (
    code VARCHAR(30) PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE match_statuses (
    code VARCHAR(30) PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE result_types (
    code VARCHAR(40) PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE scoring_types (
    code VARCHAR(30) PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE score_directions (
    code VARCHAR(30) PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE winner_resolution_types (
    code VARCHAR(30) PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE statistic_value_types (
    code VARCHAR(30) PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE statistic_target_types (
    code VARCHAR(30) PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE outcome_types (
    code VARCHAR(30) PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE loan_statuses (
    code VARCHAR(30) PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE sale_listing_statuses (
    code VARCHAR(30) PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE trade_statuses (
    code VARCHAR(30) PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE trade_item_sides (
    code VARCHAR(30) PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE share_permissions (
    code VARCHAR(30) PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE reaction_types (
    code VARCHAR(30) PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE
);

CREATE TABLE merge_statuses (
    code VARCHAR(30) PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE
);


-- ============================================================================
-- 2. IDENTIDAD Y CONTROL DE ACCESO
-- ============================================================================

CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR(320) NOT NULL UNIQUE,
    username VARCHAR(80) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    status_code VARCHAR(30) NOT NULL REFERENCES user_statuses(code),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deactivated_at TIMESTAMPTZ
);

CREATE TABLE profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    display_name VARCHAR(120),
    bio TEXT,
    avatar_url TEXT,
    location_text VARCHAR(160),
    visibility_code VARCHAR(30) NOT NULL REFERENCES visibility_levels(code),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (visibility_code IN ('PRIVATE', 'PUBLIC'))
);

-- Roles globales del sistema: USER, MODERATOR, ADMIN, CONTENT_MANAGER, etc.
CREATE TABLE roles (
    code VARCHAR(60) PRIMARY KEY,
    name VARCHAR(120) NOT NULL UNIQUE,
    description TEXT
);

-- Permisos atómicos consumibles por middleware, ej. moderation.approve
CREATE TABLE permissions (
    code VARCHAR(120) PRIMARY KEY,
    description TEXT NOT NULL
);

CREATE TABLE user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_code VARCHAR(60) NOT NULL REFERENCES roles(code) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    assigned_by_user_id UUID REFERENCES users(id),
    PRIMARY KEY (user_id, role_code)
);

CREATE TABLE role_permissions (
    role_code VARCHAR(60) NOT NULL REFERENCES roles(code) ON DELETE CASCADE,
    permission_code VARCHAR(120) NOT NULL REFERENCES permissions(code) ON DELETE CASCADE,
    PRIMARY KEY (role_code, permission_code)
);


-- ============================================================================
-- 3. SOCIAL Y GRUPOS
-- ============================================================================

CREATE TABLE follows (
    follower_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    followed_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (follower_user_id, followed_user_id),
    CHECK (follower_user_id <> followed_user_id)
);

CREATE TABLE groups (
    id UUID PRIMARY KEY,
    name VARCHAR(140) NOT NULL,
    description TEXT,
    visibility_code VARCHAR(30) NOT NULL REFERENCES visibility_levels(code),
    created_by_user_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archived_at TIMESTAMPTZ,
    CHECK (visibility_code IN ('PRIVATE', 'PUBLIC'))
);

CREATE TABLE group_members (
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    role_code VARCHAR(30) NOT NULL REFERENCES group_roles(code),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (group_id, user_id)
);


-- ============================================================================
-- 4. LUDOTECAS
-- ============================================================================

CREATE TABLE collections (
    id UUID PRIMARY KEY,
    group_id UUID REFERENCES groups(id),
    name VARCHAR(140) NOT NULL,
    description TEXT,
    visibility_code VARCHAR(30) NOT NULL REFERENCES visibility_levels(code),
    is_for_sale BOOLEAN NOT NULL DEFAULT FALSE,
    created_by_user_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archived_at TIMESTAMPTZ,
    CHECK (visibility_code <> 'GROUP' OR group_id IS NOT NULL)
);

-- La pertenencia explícita a una ludoteca es independiente del Follow.
-- Una colección ligada a un grupo puede seguir teniendo miembros individuales.
CREATE TABLE collection_members (
    collection_id UUID NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    role_code VARCHAR(30) NOT NULL REFERENCES collection_roles(code),
    joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (collection_id, user_id)
);


-- ============================================================================
-- 5. CATÁLOGO DE JUEGOS
-- ============================================================================

CREATE TABLE publishers (
    id UUID PRIMARY KEY,
    name VARCHAR(180) NOT NULL,
    website_url TEXT,
    country_code VARCHAR(3),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (name)
);

CREATE TABLE people (
    id UUID PRIMARY KEY,
    name VARCHAR(180) NOT NULL,
    bio TEXT,
    website_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE games (
    id UUID PRIMARY KEY,
    name VARCHAR(220) NOT NULL,
    description TEXT,
    publication_year SMALLINT,
    min_players SMALLINT NOT NULL,
    max_players SMALLINT NOT NULL,
    min_duration_minutes INTEGER,
    max_duration_minutes INTEGER,
    min_age SMALLINT,
    max_age SMALLINT,
    complexity NUMERIC(3,2),
    classification_code VARCHAR(30) NOT NULL REFERENCES game_classifications(code),
    visibility_code VARCHAR(30) NOT NULL REFERENCES visibility_levels(code),
    scope_group_id UUID REFERENCES groups(id),
    moderation_status_code VARCHAR(40) NOT NULL REFERENCES moderation_statuses(code),
    created_by_user_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archived_at TIMESTAMPTZ,
    CHECK (min_players >= 1),
    CHECK (max_players >= min_players),
    CHECK (min_duration_minutes IS NULL OR min_duration_minutes >= 0),
    CHECK (max_duration_minutes IS NULL OR max_duration_minutes >= min_duration_minutes),
    CHECK (min_age IS NULL OR min_age >= 0),
    CHECK (max_age IS NULL OR max_age >= min_age),
    CHECK (complexity IS NULL OR (complexity >= 0 AND complexity <= 5)),
    CHECK (
        (visibility_code = 'PRIVATE' AND created_by_user_id IS NOT NULL AND scope_group_id IS NULL)
        OR
        (visibility_code = 'GROUP' AND created_by_user_id IS NOT NULL AND scope_group_id IS NOT NULL)
        OR
        (visibility_code = 'PUBLIC' AND scope_group_id IS NULL)
    )
);

CREATE TABLE game_editions (
    id UUID PRIMARY KEY,
    game_id UUID NOT NULL REFERENCES games(id),
    edition_name VARCHAR(180),
    edition_number VARCHAR(80),
    language_code VARCHAR(12),
    publication_year SMALLINT,
    isbn VARCHAR(32),
    sku VARCHAR(80),
    upc VARCHAR(32),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Permite una o varias editoriales/licenciantes/distribuidores por edición.
CREATE TABLE edition_publishers (
    game_edition_id UUID NOT NULL REFERENCES game_editions(id) ON DELETE CASCADE,
    publisher_id UUID NOT NULL REFERENCES publishers(id),
    relation_type_code VARCHAR(30) NOT NULL REFERENCES publisher_relation_types(code),
    PRIMARY KEY (game_edition_id, publisher_id, relation_type_code)
);

CREATE TABLE categories (
    id UUID PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    visibility_code VARCHAR(30) NOT NULL REFERENCES visibility_levels(code),
    scope_group_id UUID REFERENCES groups(id),
    moderation_status_code VARCHAR(40) NOT NULL REFERENCES moderation_statuses(code),
    created_by_user_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (
        (visibility_code = 'PRIVATE' AND created_by_user_id IS NOT NULL AND scope_group_id IS NULL)
        OR
        (visibility_code = 'GROUP' AND created_by_user_id IS NOT NULL AND scope_group_id IS NOT NULL)
        OR
        (visibility_code = 'PUBLIC' AND scope_group_id IS NULL)
    )
);

CREATE TABLE game_categories (
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id),
    PRIMARY KEY (game_id, category_id)
);

CREATE TABLE mechanics (
    id UUID PRIMARY KEY,
    name VARCHAR(140) NOT NULL,
    description TEXT,
    visibility_code VARCHAR(30) NOT NULL REFERENCES visibility_levels(code),
    scope_group_id UUID REFERENCES groups(id),
    moderation_status_code VARCHAR(40) NOT NULL REFERENCES moderation_statuses(code),
    created_by_user_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (
        (visibility_code = 'PRIVATE' AND created_by_user_id IS NOT NULL AND scope_group_id IS NULL)
        OR
        (visibility_code = 'GROUP' AND created_by_user_id IS NOT NULL AND scope_group_id IS NOT NULL)
        OR
        (visibility_code = 'PUBLIC' AND scope_group_id IS NULL)
    )
);

CREATE TABLE game_mechanics (
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    mechanic_id UUID NOT NULL REFERENCES mechanics(id),
    PRIMARY KEY (game_id, mechanic_id)
);

CREATE TABLE game_people (
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    person_id UUID NOT NULL REFERENCES people(id),
    role_code VARCHAR(30) NOT NULL REFERENCES game_person_roles(code),
    PRIMARY KEY (game_id, person_id, role_code)
);

-- Una expansión también es un Game.
-- standalone_playable solo es significativo para relaciones de expansión.
CREATE TABLE game_relationships (
    id UUID PRIMARY KEY,
    source_game_id UUID NOT NULL REFERENCES games(id),
    target_game_id UUID NOT NULL REFERENCES games(id),
    relation_type_code VARCHAR(40) NOT NULL REFERENCES game_relation_types(code),
    standalone_playable BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (source_game_id, target_game_id, relation_type_code),
    CHECK (source_game_id <> target_game_id)
);

-- Recurso asociado al Game abstracto O a una Edition concreta.
CREATE TABLE game_resources (
    id UUID PRIMARY KEY,
    game_id UUID REFERENCES games(id) ON DELETE CASCADE,
    game_edition_id UUID REFERENCES game_editions(id) ON DELETE CASCADE,
    resource_type_code VARCHAR(40) NOT NULL REFERENCES resource_types(code),
    title VARCHAR(180),
    url TEXT NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (
        (game_id IS NOT NULL AND game_edition_id IS NULL)
        OR
        (game_id IS NULL AND game_edition_id IS NOT NULL)
    )
);

CREATE TABLE accessories (
    id UUID PRIMARY KEY,
    game_id UUID REFERENCES games(id),
    name VARCHAR(180) NOT NULL,
    description TEXT,
    visibility_code VARCHAR(30) NOT NULL REFERENCES visibility_levels(code),
    scope_group_id UUID REFERENCES groups(id),
    created_by_user_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (
        (visibility_code = 'PRIVATE' AND created_by_user_id IS NOT NULL AND scope_group_id IS NULL)
        OR
        (visibility_code = 'GROUP' AND created_by_user_id IS NOT NULL AND scope_group_id IS NOT NULL)
        OR
        (visibility_code = 'PUBLIC' AND scope_group_id IS NULL)
    )
);

-- Configuración GLOBAL/base versionada para interpretar el resultado final.
-- Una versión utilizada por una partida se vuelve semánticamente inmutable.
CREATE TABLE game_result_configs (
    id UUID PRIMARY KEY,
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    result_type_code VARCHAR(40) NOT NULL REFERENCES result_types(code),
    scoring_type_code VARCHAR(30) NOT NULL REFERENCES scoring_types(code),
    score_direction_code VARCHAR(30) NOT NULL REFERENCES score_directions(code),
    winner_resolution_code VARCHAR(30) NOT NULL REFERENCES winner_resolution_types(code),
    allow_ties BOOLEAN NOT NULL DEFAULT FALSE,
    score_required BOOLEAN NOT NULL DEFAULT FALSE,
    result_required_when_completed BOOLEAN NOT NULL DEFAULT TRUE,
    is_current BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    retired_at TIMESTAMPTZ,
    UNIQUE (game_id, version_number),
    UNIQUE (id, game_id),
    CHECK (version_number >= 1),
    CHECK (is_current OR retired_at IS NOT NULL),
    CHECK (NOT is_current OR retired_at IS NULL)
);

-- Configuración adicional específica de un juego.
-- Puede ser global/aprobada o privada/grupal.
CREATE TABLE statistic_definitions (
    id UUID PRIMARY KEY,
    game_id UUID NOT NULL REFERENCES games(id),
    name VARCHAR(160) NOT NULL,
    description TEXT,
    value_type_code VARCHAR(30) NOT NULL REFERENCES statistic_value_types(code),
    target_type_code VARCHAR(30) NOT NULL REFERENCES statistic_target_types(code),
    unit_label VARCHAR(40),
    is_required BOOLEAN NOT NULL DEFAULT FALSE,
    display_order INTEGER NOT NULL DEFAULT 0,
    min_numeric NUMERIC(18,4),
    max_numeric NUMERIC(18,4),
    visibility_code VARCHAR(30) NOT NULL REFERENCES visibility_levels(code),
    moderation_status_code VARCHAR(40) NOT NULL REFERENCES moderation_statuses(code),
    created_by_user_id UUID REFERENCES users(id),
    group_id UUID REFERENCES groups(id),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (
        min_numeric IS NULL
        OR max_numeric IS NULL
        OR min_numeric <= max_numeric
    ),
    CHECK (
        (visibility_code = 'PRIVATE' AND created_by_user_id IS NOT NULL AND group_id IS NULL)
        OR
        (visibility_code = 'GROUP' AND created_by_user_id IS NOT NULL AND group_id IS NOT NULL)
        OR
        (visibility_code = 'PUBLIC' AND group_id IS NULL)
    )
);

CREATE TABLE statistic_options (
    id UUID PRIMARY KEY,
    statistic_definition_id UUID NOT NULL REFERENCES statistic_definitions(id) ON DELETE CASCADE,
    option_key VARCHAR(80) NOT NULL,
    label VARCHAR(140) NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (statistic_definition_id, option_key)
);

CREATE TABLE user_game_notes (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game_id UUID NOT NULL REFERENCES games(id),
    note TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, game_id)
);


-- ============================================================================
-- 6. INVENTARIO / COPIAS FÍSICAS
-- ============================================================================

CREATE TABLE copies (
    id UUID PRIMARY KEY,
    current_collection_id UUID REFERENCES collections(id),
    game_id UUID NOT NULL REFERENCES games(id),
    game_edition_id UUID REFERENCES game_editions(id),
    label VARCHAR(160),
    condition_status_code VARCHAR(30) NOT NULL REFERENCES copy_condition_statuses(code),
    lifecycle_status_code VARCHAR(30) NOT NULL REFERENCES copy_lifecycle_statuses(code),
    exit_reason_code VARCHAR(30) REFERENCES copy_exit_reasons(code),
    location_label VARCHAR(160),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (
        (lifecycle_status_code = 'ACTIVE' AND current_collection_id IS NOT NULL AND exit_reason_code IS NULL)
        OR
        (lifecycle_status_code = 'EXITED' AND current_collection_id IS NULL AND exit_reason_code IS NOT NULL)
    )
);

-- Historial de permanencia de una copia en distintas ludotecas.
-- El Audit Log no reemplaza este historial de negocio.
CREATE TABLE copy_collection_history (
    id UUID PRIMARY KEY,
    copy_id UUID NOT NULL REFERENCES copies(id),
    collection_id UUID NOT NULL REFERENCES collections(id),
    entered_at TIMESTAMPTZ NOT NULL,
    exited_at TIMESTAMPTZ,
    change_reason VARCHAR(80),
    changed_by_user_id UUID REFERENCES users(id),
    CHECK (exited_at IS NULL OR exited_at >= entered_at)
);

-- Una misma copia puede tener varias adquisiciones históricas si cambia de
-- propietario dentro del sistema. Moverla entre colecciones del mismo dueño
-- no implica una nueva Acquisition.
CREATE TABLE acquisitions (
    id UUID PRIMARY KEY,
    copy_id UUID NOT NULL REFERENCES copies(id),
    destination_collection_id UUID NOT NULL REFERENCES collections(id),
    acquisition_type_code VARCHAR(30) NOT NULL REFERENCES acquisition_types(code),
    acquired_at TIMESTAMPTZ,
    amount NUMERIC(14,2),
    currency_code CHAR(3),
    source_user_id UUID REFERENCES users(id),
    source_name VARCHAR(180),
    recorded_by_user_id UUID REFERENCES users(id),
    notes TEXT,
    CHECK (amount IS NULL OR amount >= 0),
    CHECK (currency_code IS NULL OR amount IS NOT NULL)
);

CREATE TABLE copy_accessories (
    copy_id UUID NOT NULL REFERENCES copies(id) ON DELETE CASCADE,
    accessory_id UUID NOT NULL REFERENCES accessories(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    notes TEXT,
    PRIMARY KEY (copy_id, accessory_id),
    CHECK (quantity >= 1)
);


-- ============================================================================
-- 7. PRÉSTAMOS, VENTAS E INTERCAMBIOS
-- ============================================================================

CREATE TABLE loans (
    id UUID PRIMARY KEY,
    copy_id UUID NOT NULL REFERENCES copies(id),
    created_by_user_id UUID NOT NULL REFERENCES users(id),
    borrower_user_id UUID REFERENCES users(id),
    borrower_name VARCHAR(180),
    status_code VARCHAR(30) NOT NULL REFERENCES loan_statuses(code),
    loaned_at TIMESTAMPTZ NOT NULL,
    due_at TIMESTAMPTZ,
    returned_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (borrower_user_id IS NOT NULL OR borrower_name IS NOT NULL),
    CHECK (due_at IS NULL OR due_at >= loaned_at),
    CHECK (returned_at IS NULL OR returned_at >= loaned_at)
);

CREATE TABLE sale_listings (
    id UUID PRIMARY KEY,
    copy_id UUID NOT NULL REFERENCES copies(id),
    source_collection_id UUID NOT NULL REFERENCES collections(id),
    created_by_user_id UUID NOT NULL REFERENCES users(id),
    asking_price NUMERIC(14,2),
    currency_code CHAR(3),
    status_code VARCHAR(30) NOT NULL REFERENCES sale_listing_statuses(code),
    published_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (asking_price IS NULL OR asking_price >= 0),
    CHECK (
        (asking_price IS NULL AND currency_code IS NULL)
        OR
        (asking_price IS NOT NULL AND currency_code IS NOT NULL)
    ),
    CHECK (status_code IN ('DRAFT', 'CANCELLED') OR asking_price IS NOT NULL),
    CHECK (closed_at IS NULL OR published_at IS NULL OR closed_at >= published_at)
);

-- buyer_user_id puede ser NULL: permite venta a un comprador externo.
-- destination_collection_id también puede ser NULL: la copia sale del sistema.
CREATE TABLE sale_transactions (
    id UUID PRIMARY KEY,
    sale_listing_id UUID REFERENCES sale_listings(id),
    copy_id UUID NOT NULL REFERENCES copies(id),
    source_collection_id UUID NOT NULL REFERENCES collections(id),
    recorded_by_user_id UUID NOT NULL REFERENCES users(id),
    buyer_user_id UUID REFERENCES users(id),
    buyer_name VARCHAR(180),
    destination_collection_id UUID REFERENCES collections(id),
    sold_price NUMERIC(14,2) NOT NULL,
    currency_code CHAR(3) NOT NULL,
    sold_at TIMESTAMPTZ NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (sold_price >= 0),
    CHECK (destination_collection_id IS NULL OR buyer_user_id IS NOT NULL)
);

CREATE TABLE trades (
    id UUID PRIMARY KEY,
    initiated_by_user_id UUID NOT NULL REFERENCES users(id),
    counterparty_user_id UUID REFERENCES users(id),
    counterparty_name VARCHAR(180),
    status_code VARCHAR(30) NOT NULL REFERENCES trade_statuses(code),
    proposed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    accepted_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    notes TEXT,
    CHECK (counterparty_user_id IS NOT NULL OR counterparty_name IS NOT NULL)
);

-- Para un item ya existente en el sistema se usa copy_id.
-- Para un item externo entrante se puede usar game_id/game_edition_id y,
-- al completarse, resulting_copy_id puede apuntar a la nueva copia creada.
CREATE TABLE trade_items (
    id UUID PRIMARY KEY,
    trade_id UUID NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
    side_code VARCHAR(30) NOT NULL REFERENCES trade_item_sides(code),
    copy_id UUID REFERENCES copies(id),
    game_id UUID REFERENCES games(id),
    game_edition_id UUID REFERENCES game_editions(id),
    resulting_copy_id UUID REFERENCES copies(id),
    notes TEXT,
    CHECK (
        (copy_id IS NOT NULL AND game_id IS NULL)
        OR
        (copy_id IS NULL AND game_id IS NOT NULL)
    )
);


-- ============================================================================
-- 8. PARTIDAS, RESULTADOS Y ESTADÍSTICAS
-- ============================================================================

CREATE TABLE matches (
    id UUID PRIMARY KEY,
    game_id UUID NOT NULL REFERENCES games(id),
    result_config_id UUID NOT NULL,
    game_edition_id UUID REFERENCES game_editions(id),
    copy_id UUID REFERENCES copies(id),
    created_by_user_id UUID NOT NULL REFERENCES users(id),
    group_id UUID REFERENCES groups(id),
    collection_id UUID REFERENCES collections(id),
    status_code VARCHAR(30) NOT NULL REFERENCES match_statuses(code),
    visibility_code VARCHAR(30) NOT NULL REFERENCES visibility_levels(code),
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    duration_minutes INTEGER,
    location_text VARCHAR(220),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (ended_at IS NULL OR ended_at >= started_at),
    CHECK (duration_minutes IS NULL OR duration_minutes >= 0),
    CHECK (visibility_code <> 'GROUP' OR group_id IS NOT NULL),
    FOREIGN KEY (result_config_id, game_id)
        REFERENCES game_result_configs(id, game_id)
);

CREATE TABLE match_expansions (
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    expansion_game_id UUID NOT NULL REFERENCES games(id),
    expansion_edition_id UUID REFERENCES game_editions(id),
    PRIMARY KEY (match_id, expansion_game_id),
    CHECK (match_id IS NOT NULL)
);

CREATE TABLE match_teams (
    id UUID PRIMARY KEY,
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL
);

-- user_id NULL + guest_name => invitado sin cuenta.
CREATE TABLE match_participants (
    id UUID PRIMARY KEY,
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id),
    guest_name VARCHAR(160),
    display_name_snapshot VARCHAR(160),
    team_id UUID REFERENCES match_teams(id),
    seat_order SMALLINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (user_id IS NOT NULL OR guest_name IS NOT NULL),
    CHECK (seat_order IS NULL OR seat_order >= 1)
);

-- Resultado FINAL del participante, no por ronda.
CREATE TABLE match_participant_results (
    match_participant_id UUID PRIMARY KEY REFERENCES match_participants(id) ON DELETE CASCADE,
    outcome_type_code VARCHAR(30) REFERENCES outcome_types(code),
    rank_position SMALLINT,
    score_numeric NUMERIC(18,4),
    score_text VARCHAR(180),
    notes TEXT,
    CHECK (rank_position IS NULL OR rank_position >= 1)
);

CREATE TABLE match_team_results (
    match_team_id UUID PRIMARY KEY REFERENCES match_teams(id) ON DELETE CASCADE,
    outcome_type_code VARCHAR(30) REFERENCES outcome_types(code),
    rank_position SMALLINT,
    score_numeric NUMERIC(18,4),
    score_text VARCHAR(180),
    notes TEXT,
    CHECK (rank_position IS NULL OR rank_position >= 1)
);

-- Valor para una definición adicional de estadísticas.
-- target:
--   MATCH       => participant_id y team_id NULL
--   PARTICIPANT => participant_id
--   TEAM        => team_id
-- La coherencia con statistic_definitions.target_type_code se valida en servicio.
CREATE TABLE match_stat_values (
    id UUID PRIMARY KEY,
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    statistic_definition_id UUID NOT NULL REFERENCES statistic_definitions(id),
    match_participant_id UUID REFERENCES match_participants(id) ON DELETE CASCADE,
    match_team_id UUID REFERENCES match_teams(id) ON DELETE CASCADE,
    value_integer BIGINT,
    value_numeric NUMERIC(18,4),
    value_boolean BOOLEAN,
    value_text TEXT,
    value_option_id UUID REFERENCES statistic_options(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (NOT (match_participant_id IS NOT NULL AND match_team_id IS NOT NULL)),
    CHECK (
        (CASE WHEN value_integer IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN value_numeric IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN value_boolean IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN value_text IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN value_option_id IS NOT NULL THEN 1 ELSE 0 END)
        = 1
    )
);

CREATE TABLE match_media (
    id UUID PRIMARY KEY,
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    resource_type_code VARCHAR(40) NOT NULL REFERENCES resource_types(code),
    url TEXT NOT NULL,
    caption VARCHAR(220),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================================
-- 9. VALORACIONES Y CONTENIDO SOCIAL
-- ============================================================================

CREATE TABLE ratings (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game_id UUID NOT NULL REFERENCES games(id),
    score NUMERIC(4,2) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, game_id),
    CHECK (score >= 1 AND score <= 10)
);

CREATE TABLE reviews (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    game_id UUID NOT NULL REFERENCES games(id),
    title VARCHAR(180),
    body TEXT NOT NULL,
    visibility_code VARCHAR(30) NOT NULL REFERENCES visibility_levels(code),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archived_at TIMESTAMPTZ,
    UNIQUE (user_id, game_id),
    CHECK (visibility_code IN ('PRIVATE', 'PUBLIC'))
);

CREATE TABLE review_reactions (
    review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reaction_type_code VARCHAR(30) NOT NULL REFERENCES reaction_types(code),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (review_id, user_id)
);

CREATE TABLE review_comments (
    id UUID PRIMARY KEY,
    review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    parent_comment_id UUID REFERENCES review_comments(id),
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archived_at TIMESTAMPTZ
);

CREATE TABLE favorites (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game_id UUID NOT NULL REFERENCES games(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, game_id)
);

CREATE TABLE wishlist_items (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game_id UUID NOT NULL REFERENCES games(id),
    priority SMALLINT,
    target_price NUMERIC(14,2),
    currency_code CHAR(3),
    notes TEXT,
    added_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, game_id),
    CHECK (priority IS NULL OR (priority >= 1 AND priority <= 5)),
    CHECK (target_price IS NULL OR target_price >= 0),
    CHECK (currency_code IS NULL OR target_price IS NOT NULL)
);


-- ============================================================================
-- 10. SHARING / ACCESO EXPLÍCITO
-- ============================================================================

-- El recurso conserva su visibilidad original.
-- Share solo concede una vía explícita de acceso.
CREATE TABLE shares (
    id UUID PRIMARY KEY,
    created_by_user_id UUID NOT NULL REFERENCES users(id),

    -- Target: exactamente uno
    game_id UUID REFERENCES games(id),
    match_id UUID REFERENCES matches(id),
    collection_id UUID REFERENCES collections(id),
    review_id UUID REFERENCES reviews(id),

    -- Recipient/access path: exactamente uno
    recipient_user_id UUID REFERENCES users(id),
    recipient_group_id UUID REFERENCES groups(id),
    access_token_hash VARCHAR(255),

    permission_code VARCHAR(30) NOT NULL REFERENCES share_permissions(code),
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CHECK (
        (CASE WHEN game_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN match_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN collection_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN review_id IS NOT NULL THEN 1 ELSE 0 END)
        = 1
    ),
    CHECK (
        (CASE WHEN recipient_user_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN recipient_group_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN access_token_hash IS NOT NULL THEN 1 ELSE 0 END)
        = 1
    )
);


-- ============================================================================
-- 11. MODERACIÓN Y MERGES
-- ============================================================================

-- Moderación reutilizable inicialmente para Game, StatisticDefinition,
-- Category y Mechanic.
CREATE TABLE moderation_cases (
    id UUID PRIMARY KEY,

    -- Target: exactamente uno
    game_id UUID REFERENCES games(id),
    statistic_definition_id UUID REFERENCES statistic_definitions(id),
    category_id UUID REFERENCES categories(id),
    mechanic_id UUID REFERENCES mechanics(id),

    current_status_code VARCHAR(40) NOT NULL REFERENCES moderation_statuses(code),
    submitted_by_user_id UUID NOT NULL REFERENCES users(id),
    assigned_to_user_id UUID REFERENCES users(id),
    submission_note TEXT,
    resolution_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMPTZ,

    CHECK (
        (CASE WHEN game_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN statistic_definition_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN category_id IS NOT NULL THEN 1 ELSE 0 END) +
        (CASE WHEN mechanic_id IS NOT NULL THEN 1 ELSE 0 END)
        = 1
    )
);

CREATE TABLE moderation_actions (
    id UUID PRIMARY KEY,
    moderation_case_id UUID NOT NULL REFERENCES moderation_cases(id) ON DELETE CASCADE,
    actor_user_id UUID NOT NULL REFERENCES users(id),
    from_status_code VARCHAR(40) REFERENCES moderation_statuses(code),
    to_status_code VARCHAR(40) NOT NULL REFERENCES moderation_statuses(code),
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE game_merges (
    id UUID PRIMARY KEY,
    source_game_id UUID NOT NULL REFERENCES games(id),
    target_game_id UUID NOT NULL REFERENCES games(id),
    status_code VARCHAR(30) NOT NULL REFERENCES merge_statuses(code),
    requested_by_user_id UUID NOT NULL REFERENCES users(id),
    approved_by_user_id UUID REFERENCES users(id),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMPTZ,
    notes TEXT,
    CHECK (source_game_id <> target_game_id),
    UNIQUE (source_game_id, target_game_id)
);


-- ============================================================================
-- 12. AUDITORÍA
-- ============================================================================

-- JSONB está justificado aquí porque AuditLog debe poder capturar snapshots
-- heterogéneos sin convertirse en el modelo de negocio.
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY,
    actor_user_id UUID REFERENCES users(id),
    action_code VARCHAR(140) NOT NULL,
    entity_type VARCHAR(120) NOT NULL,
    entity_id UUID,
    old_data JSONB,
    new_data JSONB,
    metadata JSONB,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================================
-- 13. ÍNDICES Y REGLAS DE UNICIDAD OPERATIVA
-- ============================================================================

CREATE INDEX idx_group_members_user
    ON group_members(user_id);

CREATE INDEX idx_collection_members_user
    ON collection_members(user_id);

CREATE INDEX idx_games_name
    ON games(name);

-- Solo puede existir una configuración vigente por juego.
CREATE UNIQUE INDEX uq_game_result_config_current
    ON game_result_configs(game_id)
    WHERE is_current;

CREATE INDEX idx_game_editions_game
    ON game_editions(game_id);

CREATE INDEX idx_copies_game
    ON copies(game_id);

CREATE INDEX idx_copies_collection
    ON copies(current_collection_id);

CREATE INDEX idx_matches_game_started
    ON matches(game_id, started_at);

CREATE INDEX idx_matches_creator_started
    ON matches(created_by_user_id, started_at);

CREATE INDEX idx_match_participants_user
    ON match_participants(user_id);

CREATE INDEX idx_reviews_game
    ON reviews(game_id);

CREATE INDEX idx_audit_entity
    ON audit_logs(entity_type, entity_id, occurred_at);

-- Una copia solo puede tener una permanencia "abierta" en historial.
CREATE UNIQUE INDEX uq_copy_collection_history_open
    ON copy_collection_history(copy_id)
    WHERE exited_at IS NULL;

-- Una copia solo puede tener un préstamo activo.
CREATE UNIQUE INDEX uq_loans_active_copy
    ON loans(copy_id)
    WHERE status_code = 'ACTIVE';

-- Una copia solo puede tener una publicación de venta operativa a la vez.
CREATE UNIQUE INDEX uq_sale_listing_open_copy
    ON sale_listings(copy_id)
    WHERE status_code IN ('DRAFT', 'ACTIVE', 'RESERVED');

-- Evita duplicar valor de estadística a nivel Match.
CREATE UNIQUE INDEX uq_match_stat_match_level
    ON match_stat_values(match_id, statistic_definition_id)
    WHERE match_participant_id IS NULL AND match_team_id IS NULL;

-- Evita duplicar valor de estadística a nivel Participante.
CREATE UNIQUE INDEX uq_match_stat_participant_level
    ON match_stat_values(match_id, statistic_definition_id, match_participant_id)
    WHERE match_participant_id IS NOT NULL;

-- Evita duplicar valor de estadística a nivel Equipo.
CREATE UNIQUE INDEX uq_match_stat_team_level
    ON match_stat_values(match_id, statistic_definition_id, match_team_id)
    WHERE match_team_id IS NOT NULL;

CREATE UNIQUE INDEX uq_share_token_hash
    ON shares(access_token_hash)
    WHERE access_token_hash IS NOT NULL;


-- ============================================================================
-- 14. REGLAS QUE REQUIEREN SERVICIO / TRANSACCIÓN Y NO SOLO FK/CHECK
-- ============================================================================
--
-- 1. Una Collection debe conservar al menos un OWNER.
-- 2. Un Group debe conservar al menos un OWNER.
-- 3. Permission + ownership/membership se validan juntos:
--      requirePermission("collection.update") + acceso al recurso concreto.
-- 4. Match participants debe respetar Game.min_players / max_players.
-- 5. Una expansión dependiente requiere su juego base.
-- 6. game_edition_id de Match/Copy debe pertenecer al mismo Game.
-- 7. copy_id de Match, si existe, debe corresponder al mismo Game.
-- 8. match_stat_values debe respetar:
--      - value_type de StatisticDefinition
--      - target_type MATCH/PARTICIPANT/TEAM
--      - opciones válidas para OPTION
--      - min/max configurados
-- 9. Una partida INCOMPLETE cuenta como jugada, pero no requiere resultado final.
-- 10. CANCELLED debe excluirse de estadísticas normales de partidas jugadas.
-- 11. Para una venta interna:
--      - SaleTransaction se conserva.
--      - Copy sigue ACTIVE y se mueve a destination_collection_id.
-- 12. Para una venta externa:
--      - SaleTransaction se conserva.
--      - Copy.current_collection_id = NULL
--      - Copy.lifecycle_status_code = EXITED
--      - Copy.exit_reason_code = SOLD
-- 13. Trade COMPLETED es el único estado que transfiere propiedad.
-- 14. Share no cambia visibility_code del recurso.
-- 15. Estadística PRIVATE puede usarse por su propietario sin entrar al catálogo
--     global; para volverse global debe pasar moderación.
-- 16. Datos privados/compartidos no alimentan estadísticas globales salvo que
--     cumplan explícitamente criterios de elegibilidad global.
-- 17. Friendship se deriva de Follow mutuo; no existe tabla friends.
-- 18. Calendar se deriva de Match.started_at; no existe tabla calendar.
-- 19. Rating global, juegos más jugados, preferencias y recomendaciones son
--     derivados; no son fuente primaria en este baseline.
-- 20. moveCopy se ejecuta atómicamente: cierra el historial abierto, actualiza
--     current_collection_id, abre el nuevo historial y registra AuditLog.
-- 21. Una copia con préstamo ACTIVE no puede completar venta, trueque, regalo,
--     donación, descarte, salida ni transferencia. Si se pierde durante el
--     préstamo, se cierra como LOST y la Copy sale con exit_reason LOST.
-- 22. Mover una Copy a una Collection is_for_sale crea, si no existe, un
--     SaleListing DRAFT. El precio y la moneda son obligatorios al activarlo.
-- 23. Una GameResultConfig referenciada por Match es semánticamente inmutable;
--     los cambios crean una nueva versión y retiran la anterior.
-- 24. Una StatisticDefinition usada por MatchStatValue no cambia de semántica
--     ni de tipo; se archiva y se crea una nueva definición.
-- 25. Cada usuario conserva como máximo un Rating y una Review por Game; ambos
--     se actualizan en lugar de insertar duplicados.
-- ============================================================================
