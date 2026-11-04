-- ============================================================================
-- LUDOTECA VIRTUAL
-- Datos semilla estructurales
-- Baseline: 2026-09-16 (v1.1)
--
-- Estas semillas son "system data": necesarias para que el dominio funcione.
-- No incluyen usuarios, partidas ni catálogo comercial de juegos.
-- ============================================================================

INSERT INTO user_statuses(code, name) VALUES
('ACTIVE', 'Active'),
('SUSPENDED', 'Suspended'),
('DEACTIVATED', 'Deactivated');

INSERT INTO visibility_levels(code, name) VALUES
('PRIVATE', 'Private'),
('GROUP', 'Group'),
('PUBLIC', 'Public');

INSERT INTO moderation_statuses(code, name) VALUES
('DRAFT', 'Draft'),
('PENDING_REVIEW', 'Pending review'),
('APPROVED', 'Approved'),
('REJECTED', 'Rejected'),
('REJECTED_DUPLICATE', 'Rejected as duplicate'),
('BLOCKED', 'Blocked'),
('ARCHIVED', 'Archived');

INSERT INTO game_classifications(code, name) VALUES
('OFFICIAL', 'Official'),
('COMMUNITY', 'Community'),
('PRIVATE', 'Private');

INSERT INTO group_roles(code, name) VALUES
('OWNER', 'Owner'),
('ADMIN', 'Admin'),
('MEMBER', 'Member');

INSERT INTO collection_roles(code, name) VALUES
('OWNER', 'Owner'),
('MANAGER', 'Manager'),
('MEMBER', 'Member'),
('VIEWER', 'Viewer');

INSERT INTO copy_lifecycle_statuses(code, name) VALUES
('ACTIVE', 'Active'),
('EXITED', 'Exited from managed possession');

INSERT INTO copy_exit_reasons(code, name) VALUES
('SOLD', 'Sold externally'),
('TRADED', 'Traded externally'),
('GIFTED', 'Gifted'),
('DONATED', 'Donated'),
('LOST', 'Lost'),
('DISCARDED', 'Discarded'),
('DAMAGED', 'Removed because of damage'),
('OTHER', 'Other');

INSERT INTO copy_condition_statuses(code, name) VALUES
('NEW', 'New'),
('LIKE_NEW', 'Like new'),
('GOOD', 'Good'),
('FAIR', 'Fair'),
('POOR', 'Poor'),
('DAMAGED', 'Damaged');

INSERT INTO acquisition_types(code, name) VALUES
('PURCHASE', 'Purchase'),
('GIFT', 'Gift'),
('TRADE', 'Trade'),
('INHERITED', 'Inherited'),
('WON', 'Won'),
('OTHER', 'Other');

INSERT INTO game_relation_types(code, name) VALUES
('EXPANSION_OF', 'Expansion of'),
('SEQUEL', 'Sequel'),
('REIMPLEMENTATION', 'Reimplementation'),
('VARIANT', 'Variant'),
('PROMO', 'Promo');

INSERT INTO resource_types(code, name) VALUES
('IMAGE', 'Image'),
('RULEBOOK_PDF', 'Rulebook PDF'),
('RULEBOOK_URL', 'Rulebook URL'),
('TUTORIAL_VIDEO', 'Tutorial video'),
('REVIEW_VIDEO', 'Review video'),
('TRAILER_VIDEO', 'Trailer video'),
('GAMEPLAY_VIDEO', 'Gameplay video'),
('OFFICIAL_WEBSITE', 'Official website'),
('OTHER', 'Other');

INSERT INTO game_person_roles(code, name) VALUES
('DESIGNER', 'Designer'),
('AUTHOR', 'Author'),
('ARTIST', 'Artist'),
('DEVELOPER', 'Developer'),
('OTHER', 'Other');

INSERT INTO publisher_relation_types(code, name) VALUES
('PUBLISHER', 'Publisher'),
('DISTRIBUTOR', 'Distributor'),
('LICENSOR', 'Licensor');

INSERT INTO match_statuses(code, name) VALUES
('COMPLETED', 'Completed'),
('INCOMPLETE', 'Incomplete'),
('CANCELLED', 'Cancelled');

INSERT INTO result_types(code, name) VALUES
('INDIVIDUAL_WINNER', 'Individual winner'),
('RANKING', 'Ranking'),
('TEAM', 'Team'),
('COOPERATIVE', 'Cooperative'),
('OBJECTIVE', 'Objective based'),
('NO_WINNER', 'No winner / non competitive'),
('CUSTOM', 'Custom');

INSERT INTO scoring_types(code, name) VALUES
('POINTS', 'Points'),
('MONEY', 'Money'),
('TIME', 'Time'),
('OBJECTIVES', 'Objectives'),
('NONE', 'None'),
('CUSTOM', 'Custom');

INSERT INTO score_directions(code, name) VALUES
('HIGHER_IS_BETTER', 'Higher is better'),
('LOWER_IS_BETTER', 'Lower is better'),
('NOT_APPLICABLE', 'Not applicable');

INSERT INTO winner_resolution_types(code, name) VALUES
('MANUAL', 'Winner selected explicitly'),
('BY_SCORE', 'Derived from score'),
('BY_TEAM_RESULT', 'Derived from team result'),
('NONE', 'No winner resolution');

INSERT INTO statistic_value_types(code, name) VALUES
('INTEGER', 'Integer'),
('DECIMAL', 'Decimal'),
('BOOLEAN', 'Boolean'),
('TEXT', 'Text'),
('OPTION', 'Option');

INSERT INTO statistic_target_types(code, name) VALUES
('MATCH', 'Whole match'),
('PARTICIPANT', 'Participant'),
('TEAM', 'Team');

INSERT INTO outcome_types(code, name) VALUES
('WIN', 'Win'),
('LOSS', 'Loss'),
('DRAW', 'Draw'),
('NO_RESULT', 'No final result');

INSERT INTO loan_statuses(code, name) VALUES
('ACTIVE', 'Active'),
('RETURNED', 'Returned'),
('CANCELLED', 'Cancelled'),
('LOST', 'Lost while loaned');

INSERT INTO sale_listing_statuses(code, name) VALUES
('DRAFT', 'Draft'),
('ACTIVE', 'Active'),
('RESERVED', 'Reserved'),
('SOLD', 'Sold'),
('CANCELLED', 'Cancelled'),
('EXPIRED', 'Expired');

INSERT INTO trade_statuses(code, name) VALUES
('PROPOSED', 'Proposed'),
('ACCEPTED', 'Accepted'),
('REJECTED', 'Rejected'),
('CANCELLED', 'Cancelled'),
('COMPLETED', 'Completed');

INSERT INTO trade_item_sides(code, name) VALUES
('OFFERED', 'Offered by initiator'),
('REQUESTED', 'Requested from counterparty');

INSERT INTO share_permissions(code, name) VALUES
('VIEW', 'View'),
('COMMENT', 'Comment'),
('EDIT', 'Edit');

INSERT INTO reaction_types(code, name) VALUES
('LIKE', 'Like'),
('DISLIKE', 'Dislike');

INSERT INTO merge_statuses(code, name) VALUES
('PENDING', 'Pending'),
('APPROVED', 'Approved'),
('REJECTED', 'Rejected'),
('COMPLETED', 'Completed'),
('CANCELLED', 'Cancelled');


-- ============================================================================
-- Roles globales
-- ============================================================================

INSERT INTO roles(code, name, description) VALUES
('USER', 'User', 'Standard product user'),
('MODERATOR', 'Moderator', 'Can review and moderate submitted content'),
('CONTENT_MANAGER', 'Content Manager', 'Can manage public catalog content'),
('ADMIN', 'Administrator', 'Full administrative access');


-- ============================================================================
-- Permisos atómicos
-- ============================================================================

INSERT INTO permissions(code, description) VALUES
('profile.update', 'Update own profile'),

('group.create', 'Create groups'),
('group.update', 'Update a group when resource access allows it'),
('group.manage_members', 'Manage group members when resource access allows it'),
('group.archive', 'Archive a group when resource access allows it'),

('collection.create', 'Create collections'),
('collection.update', 'Update a collection when resource access allows it'),
('collection.manage_members', 'Manage collection members when resource access allows it'),
('collection.archive', 'Archive a collection when resource access allows it'),

('copy.create', 'Add copies'),
('copy.update', 'Update copies when resource access allows it'),
('copy.move', 'Move copies between authorized collections'),
('copy.remove', 'Remove a copy from active possession'),

('game.create', 'Create private or draft games'),
('game.update', 'Update games when resource access allows it'),
('game.archive', 'Archive games when resource access allows it'),
('game.propose_publication', 'Submit content for global moderation'),

('match.create', 'Create matches'),
('match.update', 'Update matches when resource access allows it'),
('match.delete', 'Cancel/archive own matches when resource access allows it'),

('rating.manage', 'Create/update/delete own ratings'),
('review.create', 'Create reviews'),
('review.update', 'Update own reviews'),
('review.delete', 'Archive own reviews'),
('favorite.manage', 'Manage own favorites'),
('wishlist.manage', 'Manage own wishlist'),

('loan.create', 'Create loans for authorized copies'),
('loan.update', 'Update authorized loans'),
('loan.complete', 'Complete/return authorized loans'),

('sale.create', 'Create sale listings for authorized copies'),
('sale.update', 'Update sale listings for authorized copies'),
('sale.complete', 'Register sales for authorized copies'),

('trade.create', 'Create trades'),
('trade.update', 'Update trades when authorized'),
('trade.complete', 'Complete trades when authorized'),

('share.create', 'Share authorized content'),
('share.revoke', 'Revoke own/authorized shares'),

('moderation.view', 'View moderation queue'),
('moderation.approve', 'Approve submitted content'),
('moderation.reject', 'Reject submitted content'),
('moderation.block', 'Block submitted content'),
('moderation.merge', 'Merge duplicate games'),

('catalog.category.manage', 'Manage public categories'),
('catalog.mechanic.manage', 'Manage public mechanics'),
('catalog.publisher.manage', 'Manage publishers'),

('user.manage', 'Administrative user management'),
('role.manage', 'Manage global roles'),
('permission.manage', 'Manage permission mappings'),
('audit.view', 'View audit logs');


-- ============================================================================
-- Asignación base de permisos por rol
-- Nota: ownership/membership siempre se valida aparte.
-- ============================================================================

-- USER
INSERT INTO role_permissions(role_code, permission_code)
SELECT 'USER', code
FROM permissions
WHERE code IN (
    'profile.update',
    'group.create', 'group.update', 'group.manage_members', 'group.archive',
    'collection.create', 'collection.update', 'collection.manage_members', 'collection.archive',
    'copy.create', 'copy.update', 'copy.move', 'copy.remove',
    'game.create', 'game.update', 'game.archive', 'game.propose_publication',
    'match.create', 'match.update', 'match.delete',
    'rating.manage',
    'review.create', 'review.update', 'review.delete',
    'favorite.manage', 'wishlist.manage',
    'loan.create', 'loan.update', 'loan.complete',
    'sale.create', 'sale.update', 'sale.complete',
    'trade.create', 'trade.update', 'trade.complete',
    'share.create', 'share.revoke'
);

-- MODERATOR = USER + moderación
INSERT INTO role_permissions(role_code, permission_code)
SELECT 'MODERATOR', permission_code
FROM role_permissions
WHERE role_code = 'USER';

INSERT INTO role_permissions(role_code, permission_code)
SELECT 'MODERATOR', code
FROM permissions
WHERE code IN (
    'moderation.view',
    'moderation.approve',
    'moderation.reject',
    'moderation.block',
    'moderation.merge'
);

-- CONTENT_MANAGER = USER + moderación/catalog
INSERT INTO role_permissions(role_code, permission_code)
SELECT 'CONTENT_MANAGER', permission_code
FROM role_permissions
WHERE role_code = 'USER';

INSERT INTO role_permissions(role_code, permission_code)
SELECT 'CONTENT_MANAGER', code
FROM permissions
WHERE code IN (
    'moderation.view',
    'moderation.approve',
    'moderation.reject',
    'catalog.category.manage',
    'catalog.mechanic.manage',
    'catalog.publisher.manage'
);

-- ADMIN = todos
INSERT INTO role_permissions(role_code, permission_code)
SELECT 'ADMIN', code
FROM permissions;


-- ============================================================================
-- EJEMPLOS DE CONFIGURACIÓN DE JUEGO (NO ejecutar sin UUID reales)
-- ============================================================================
--
-- Flip 7 (conceptual):
--
-- game_result_configs (version 1, is_current = TRUE)
--   result_type_code            = 'INDIVIDUAL_WINNER'
--   scoring_type_code           = 'POINTS'
--   score_direction_code        = 'HIGHER_IS_BETTER'
--   winner_resolution_code      = 'MANUAL'
--   allow_ties                  = TRUE/FALSE según regla acordada
--   score_required              = TRUE
--
-- Catan (conceptual):
--
-- game_result_configs (version 1, is_current = TRUE)
--   result_type_code            = 'INDIVIDUAL_WINNER'
--   scoring_type_code           = 'POINTS'
--   score_direction_code        = 'HIGHER_IS_BETTER'
--   winner_resolution_code      = 'MANUAL' o 'BY_SCORE'
--   score_required              = TRUE
--
-- statistic_definitions globales potenciales para Catan:
--   BRICK  / INTEGER / PARTICIPANT
--   LUMBER / INTEGER / PARTICIPANT
--   WOOL   / INTEGER / PARTICIPANT
--   GRAIN  / INTEGER / PARTICIPANT
--   ORE    / INTEGER / PARTICIPANT
--
-- Una estadística inventada por un usuario puede crearse:
--   visibility_code = 'PRIVATE'
--   moderation_status_code = 'DRAFT' o 'APPROVED' según política privada
--   created_by_user_id = usuario
-- y usarse sin contaminar la configuración pública.
-- ============================================================================
