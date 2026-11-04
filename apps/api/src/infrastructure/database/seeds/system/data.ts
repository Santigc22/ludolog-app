export type CodeNameSeed = Readonly<{
  code: string;
  name: string;
}>;

export type LookupSeed = Readonly<{
  table: string;
  rows: readonly CodeNameSeed[];
}>;

export const gameCatalogStructuralCodes = {
  classifications: ["OFFICIAL", "COMMUNITY", "PRIVATE"],
  moderationStatuses: [
    "DRAFT",
    "PENDING_REVIEW",
    "APPROVED",
    "REJECTED",
    "REJECTED_DUPLICATE",
    "BLOCKED",
    "ARCHIVED",
  ],
  visibilityLevels: ["PRIVATE", "PUBLIC"],
} as const;

export const copyInventoryStructuralCodes = {
  lifecycleStatuses: ["ACTIVE", "EXITED"],
  conditionStatuses: ["NEW", "LIKE_NEW", "GOOD", "FAIR", "POOR", "DAMAGED"],
  exitReasons: [
    "SOLD",
    "TRADED",
    "GIFTED",
    "DONATED",
    "LOST",
    "DISCARDED",
    "DAMAGED",
    "OTHER",
  ],
  acquisitionTypes: ["PURCHASE", "GIFT", "TRADE", "INHERITED", "WON", "OTHER"],
} as const;

// GROUP exists as a shared platform visibility, but E03 has no group scope.
// Game rows must therefore reject GROUP until the group-sharing vertical exists.
export const initialGameScopePolicy = {
  privateGame: {
    classification: "PRIVATE",
    moderationStatus: "DRAFT",
    visibility: "PRIVATE",
    requiresOwner: true,
  },
  publicCatalogGame: {
    allowedClassifications: ["OFFICIAL", "COMMUNITY"],
    moderationStatus: "APPROVED",
    visibility: "PUBLIC",
    requiresOwner: false,
  },
  groupVisibilitySupported: false,
} as const;

export const lookupSeeds: readonly LookupSeed[] = [
  {
    table: "user_statuses",
    rows: [
      { code: "ACTIVE", name: "Active" },
      { code: "SUSPENDED", name: "Suspended" },
      { code: "DEACTIVATED", name: "Deactivated" },
    ],
  },
  {
    table: "visibility_levels",
    rows: [
      { code: "PRIVATE", name: "Private" },
      { code: "GROUP", name: "Group" },
      { code: "PUBLIC", name: "Public" },
    ],
  },
  {
    table: "moderation_statuses",
    rows: gameCatalogStructuralCodes.moderationStatuses.map((code) => ({
      code,
      name:
        code === "PENDING_REVIEW"
          ? "Pending review"
          : code === "REJECTED_DUPLICATE"
            ? "Rejected as duplicate"
            : code.charAt(0) + code.slice(1).toLowerCase(),
    })),
  },
  {
    table: "game_classifications",
    rows: gameCatalogStructuralCodes.classifications.map((code) => ({
      code,
      name: code.charAt(0) + code.slice(1).toLowerCase(),
    })),
  },
  {
    table: "group_roles",
    rows: [
      { code: "OWNER", name: "Owner" },
      { code: "ADMIN", name: "Admin" },
      { code: "MEMBER", name: "Member" },
    ],
  },
  {
    table: "collection_roles",
    rows: [
      { code: "OWNER", name: "Owner" },
      { code: "MANAGER", name: "Manager" },
      { code: "MEMBER", name: "Member" },
      { code: "VIEWER", name: "Viewer" },
    ],
  },
  {
    table: "collection_types",
    rows: [{ code: "PERSONAL", name: "Personal" }],
  },
  {
    table: "collection_statuses",
    rows: [
      { code: "ACTIVE", name: "Active" },
      { code: "ARCHIVED", name: "Archived" },
    ],
  },
  {
    table: "copy_lifecycle_statuses",
    rows: [
      { code: "ACTIVE", name: "Active" },
      { code: "EXITED", name: "Exited from managed possession" },
    ],
  },
  {
    table: "copy_exit_reasons",
    rows: [
      { code: "SOLD", name: "Sold externally" },
      { code: "TRADED", name: "Traded externally" },
      { code: "GIFTED", name: "Gifted" },
      { code: "DONATED", name: "Donated" },
      { code: "LOST", name: "Lost" },
      { code: "DISCARDED", name: "Discarded" },
      { code: "DAMAGED", name: "Removed because of damage" },
      { code: "OTHER", name: "Other" },
    ],
  },
  {
    table: "copy_condition_statuses",
    rows: [
      { code: "NEW", name: "New" },
      { code: "LIKE_NEW", name: "Like new" },
      { code: "GOOD", name: "Good" },
      { code: "FAIR", name: "Fair" },
      { code: "POOR", name: "Poor" },
      { code: "DAMAGED", name: "Damaged" },
    ],
  },
  {
    table: "acquisition_types",
    rows: [
      { code: "PURCHASE", name: "Purchase" },
      { code: "GIFT", name: "Gift" },
      { code: "TRADE", name: "Trade" },
      { code: "INHERITED", name: "Inherited" },
      { code: "WON", name: "Won" },
      { code: "OTHER", name: "Other" },
    ],
  },
  {
    table: "game_relation_types",
    rows: [
      { code: "EXPANSION_OF", name: "Expansion of" },
      { code: "SEQUEL", name: "Sequel" },
      { code: "REIMPLEMENTATION", name: "Reimplementation" },
      { code: "VARIANT", name: "Variant" },
      { code: "PROMO", name: "Promo" },
    ],
  },
  {
    table: "resource_types",
    rows: [
      { code: "IMAGE", name: "Image" },
      { code: "RULEBOOK_PDF", name: "Rulebook PDF" },
      { code: "RULEBOOK_URL", name: "Rulebook URL" },
      { code: "TUTORIAL_VIDEO", name: "Tutorial video" },
      { code: "REVIEW_VIDEO", name: "Review video" },
      { code: "TRAILER_VIDEO", name: "Trailer video" },
      { code: "GAMEPLAY_VIDEO", name: "Gameplay video" },
      { code: "OFFICIAL_WEBSITE", name: "Official website" },
      { code: "OTHER", name: "Other" },
    ],
  },
  {
    table: "game_person_roles",
    rows: [
      { code: "DESIGNER", name: "Designer" },
      { code: "AUTHOR", name: "Author" },
      { code: "ARTIST", name: "Artist" },
      { code: "DEVELOPER", name: "Developer" },
      { code: "OTHER", name: "Other" },
    ],
  },
  {
    table: "publisher_relation_types",
    rows: [
      { code: "PUBLISHER", name: "Publisher" },
      { code: "DISTRIBUTOR", name: "Distributor" },
      { code: "LICENSOR", name: "Licensor" },
    ],
  },
  {
    table: "match_statuses",
    rows: [
      { code: "COMPLETED", name: "Completed" },
      { code: "INCOMPLETE", name: "Incomplete" },
      { code: "CANCELLED", name: "Cancelled" },
    ],
  },
  {
    table: "result_types",
    rows: [
      { code: "INDIVIDUAL_WINNER", name: "Individual winner" },
      { code: "RANKING", name: "Ranking" },
      { code: "TEAM", name: "Team" },
      { code: "COOPERATIVE", name: "Cooperative" },
      { code: "OBJECTIVE", name: "Objective based" },
      { code: "NO_WINNER", name: "No winner / non competitive" },
      { code: "CUSTOM", name: "Custom" },
    ],
  },
  {
    table: "scoring_types",
    rows: [
      { code: "POINTS", name: "Points" },
      { code: "MONEY", name: "Money" },
      { code: "TIME", name: "Time" },
      { code: "OBJECTIVES", name: "Objectives" },
      { code: "NONE", name: "None" },
      { code: "CUSTOM", name: "Custom" },
    ],
  },
  {
    table: "score_directions",
    rows: [
      { code: "HIGHER_IS_BETTER", name: "Higher is better" },
      { code: "LOWER_IS_BETTER", name: "Lower is better" },
      { code: "NOT_APPLICABLE", name: "Not applicable" },
    ],
  },
  {
    table: "winner_resolution_types",
    rows: [
      { code: "MANUAL", name: "Winner selected explicitly" },
      { code: "BY_SCORE", name: "Derived from score" },
      { code: "BY_TEAM_RESULT", name: "Derived from team result" },
      { code: "NONE", name: "No winner resolution" },
    ],
  },
  {
    table: "statistic_value_types",
    rows: [
      { code: "INTEGER", name: "Integer" },
      { code: "DECIMAL", name: "Decimal" },
      { code: "BOOLEAN", name: "Boolean" },
      { code: "TEXT", name: "Text" },
      { code: "OPTION", name: "Option" },
    ],
  },
  {
    table: "statistic_target_types",
    rows: [
      { code: "MATCH", name: "Whole match" },
      { code: "PARTICIPANT", name: "Participant" },
      { code: "TEAM", name: "Team" },
    ],
  },
  {
    table: "outcome_types",
    rows: [
      { code: "WIN", name: "Win" },
      { code: "LOSS", name: "Loss" },
      { code: "DRAW", name: "Draw" },
      { code: "NO_RESULT", name: "No final result" },
    ],
  },
  {
    table: "loan_statuses",
    rows: [
      { code: "ACTIVE", name: "Active" },
      { code: "RETURNED", name: "Returned" },
      { code: "CANCELLED", name: "Cancelled" },
      { code: "LOST", name: "Lost while loaned" },
    ],
  },
  {
    table: "sale_listing_statuses",
    rows: [
      { code: "DRAFT", name: "Draft" },
      { code: "ACTIVE", name: "Active" },
      { code: "RESERVED", name: "Reserved" },
      { code: "SOLD", name: "Sold" },
      { code: "CANCELLED", name: "Cancelled" },
      { code: "EXPIRED", name: "Expired" },
    ],
  },
  {
    table: "trade_statuses",
    rows: [
      { code: "PROPOSED", name: "Proposed" },
      { code: "ACCEPTED", name: "Accepted" },
      { code: "REJECTED", name: "Rejected" },
      { code: "CANCELLED", name: "Cancelled" },
      { code: "COMPLETED", name: "Completed" },
    ],
  },
  {
    table: "trade_item_sides",
    rows: [
      { code: "OFFERED", name: "Offered by initiator" },
      { code: "REQUESTED", name: "Requested from counterparty" },
    ],
  },
  {
    table: "share_permissions",
    rows: [
      { code: "VIEW", name: "View" },
      { code: "COMMENT", name: "Comment" },
      { code: "EDIT", name: "Edit" },
    ],
  },
  {
    table: "reaction_types",
    rows: [
      { code: "LIKE", name: "Like" },
      { code: "DISLIKE", name: "Dislike" },
    ],
  },
  {
    table: "merge_statuses",
    rows: [
      { code: "PENDING", name: "Pending" },
      { code: "APPROVED", name: "Approved" },
      { code: "REJECTED", name: "Rejected" },
      { code: "COMPLETED", name: "Completed" },
      { code: "CANCELLED", name: "Cancelled" },
    ],
  },
] as const;

export const roleSeeds = [
  { code: "USER", name: "User", description: "Standard product user" },
  {
    code: "MODERATOR",
    name: "Moderator",
    description: "Can review and moderate submitted content",
  },
  {
    code: "CONTENT_MANAGER",
    name: "Content Manager",
    description: "Can manage public catalog content",
  },
  {
    code: "ADMIN",
    name: "Administrator",
    description: "Full administrative access",
  },
] as const;

export const permissionSeeds = [
  ["profile.update", "Update own profile"],
  ["group.create", "Create groups"],
  ["group.update", "Update a group when resource access allows it"],
  [
    "group.manage_members",
    "Manage group members when resource access allows it",
  ],
  ["group.archive", "Archive a group when resource access allows it"],
  ["collection.create", "Create collections"],
  ["collection.update", "Update a collection when resource access allows it"],
  [
    "collection.manage_members",
    "Manage collection members when resource access allows it",
  ],
  ["collection.archive", "Archive a collection when resource access allows it"],
  ["copy.create", "Add copies"],
  ["copy.update", "Update copies when resource access allows it"],
  ["copy.move", "Move copies between authorized collections"],
  ["copy.remove", "Remove a copy from active possession"],
  ["game.create", "Create private or draft games"],
  ["game.update", "Update games when resource access allows it"],
  ["game.archive", "Archive games when resource access allows it"],
  ["game.propose_publication", "Submit content for global moderation"],
  ["match.create", "Create matches"],
  ["match.update", "Update matches when resource access allows it"],
  ["match.delete", "Cancel/archive own matches when resource access allows it"],
  ["rating.manage", "Create/update/delete own ratings"],
  ["review.create", "Create reviews"],
  ["review.update", "Update own reviews"],
  ["review.delete", "Archive own reviews"],
  ["favorite.manage", "Manage own favorites"],
  ["wishlist.manage", "Manage own wishlist"],
  ["loan.create", "Create loans for authorized copies"],
  ["loan.update", "Update authorized loans"],
  ["loan.complete", "Complete/return authorized loans"],
  ["sale.create", "Create sale listings for authorized copies"],
  ["sale.update", "Update sale listings for authorized copies"],
  ["sale.complete", "Register sales for authorized copies"],
  ["trade.create", "Create trades"],
  ["trade.update", "Update trades when authorized"],
  ["trade.complete", "Complete trades when authorized"],
  ["share.create", "Share authorized content"],
  ["share.revoke", "Revoke own/authorized shares"],
  ["moderation.view", "View moderation queue"],
  ["moderation.approve", "Approve submitted content"],
  ["moderation.reject", "Reject submitted content"],
  ["moderation.block", "Block submitted content"],
  ["moderation.merge", "Merge duplicate games"],
  ["catalog.category.manage", "Manage public categories"],
  ["catalog.mechanic.manage", "Manage public mechanics"],
  ["catalog.publisher.manage", "Manage publishers"],
  ["user.manage", "Administrative user management"],
  ["role.manage", "Manage global roles"],
  ["permission.manage", "Manage permission mappings"],
  ["audit.view", "View audit logs"],
] as const;

const userPermissions = permissionSeeds
  .map(([code]) => code)
  .filter(
    (code) =>
      !code.startsWith("moderation.") &&
      !code.startsWith("catalog.") &&
      ![
        "user.manage",
        "role.manage",
        "permission.manage",
        "audit.view",
      ].includes(code),
  );

const moderatorPermissions = [
  ...userPermissions,
  "moderation.view",
  "moderation.approve",
  "moderation.reject",
  "moderation.block",
  "moderation.merge",
];

const contentManagerPermissions = [
  ...userPermissions,
  "moderation.view",
  "moderation.approve",
  "moderation.reject",
  "catalog.category.manage",
  "catalog.mechanic.manage",
  "catalog.publisher.manage",
];

export const rolePermissionSeeds = {
  USER: userPermissions,
  MODERATOR: moderatorPermissions,
  CONTENT_MANAGER: contentManagerPermissions,
  ADMIN: permissionSeeds.map(([code]) => code),
} as const;
