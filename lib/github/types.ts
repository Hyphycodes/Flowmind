/** GitHub integration types (Prompt 10). These mirror the data model in the spec.
 *  Connection metadata persists in `github_connections`; installation/OAuth tokens are
 *  ENCRYPTED server-side and NEVER sent to the client, stored in pipeline JSON, or exported. */

export type GitHubPermissionLevel = "read" | "write";

export type GitHubPermissionSummary = {
  contents?: GitHubPermissionLevel;
  pullRequests?: GitHubPermissionLevel;
  issues?: GitHubPermissionLevel;
  metadata?: GitHubPermissionLevel;
};

export type GitHubRepositoryRef = {
  id: number | string;
  owner: string;
  name: string;
  fullName: string;
  private: boolean;
  defaultBranch: string;
  htmlUrl: string;
  installationId?: string;
  permissions?: GitHubPermissionSummary;
  lastSyncedAt?: string;
};

export type GitHubConnectionStatus = "connected" | "needs_reconnect" | "revoked" | "error";

export type GitHubConnectedAccount = {
  id: string;
  userId: string;
  workspaceId?: string;
  provider: "github";
  githubUserId?: string;
  username?: string;
  avatarUrl?: string;
  installationId?: string;
  accountType?: "user" | "organization";
  accountLogin?: string;
  permissions?: GitHubPermissionSummary;
  selectedRepositories?: GitHubRepositoryRef[];
  status: GitHubConnectionStatus;
  createdAt: string;
  updatedAt: string;
};

/** Sanitized status returned to the browser. NEVER includes tokens. */
export type GitHubStatusResponse = {
  configured: boolean;
  connected: boolean;
  appSlug?: string | null;
  accountLogin?: string | null;
  accountType?: "user" | "organization" | null;
  avatarUrl?: string | null;
  installationId?: string | null;
  permissions?: GitHubPermissionSummary | null;
  repositories?: GitHubRepositoryRef[];
  status?: GitHubConnectionStatus;
  connectedAt?: string | null;
  message?: string;
};

export type GitHubFileChange = {
  path: string;
  content: string;
  /** sha of the existing blob when overwriting (required by the GitHub contents API) */
  sha?: string;
};

export type GitHubFileChangeResult = {
  path: string;
  status: "created" | "updated" | "skipped" | "failed";
  message?: string;
};

export type GitHubExportTarget = {
  connectedAccountId?: string;
  installationId?: string;
  repository: GitHubRepositoryRef;
  baseBranch: string;
  branchName: string;
  destinationPath: string;
  createPullRequest: boolean;
  pullRequestTitle?: string;
  pullRequestBody?: string;
  /** conflict policy when a file already exists at the destination */
  onConflict?: "version" | "overwrite" | "skip";
};

export type GitHubExportResult = {
  id: string;
  pipelineId: string;
  exportId?: string;
  repositoryFullName: string;
  branchName: string;
  baseBranch?: string;
  destinationPath?: string;
  commitSha?: string;
  pullRequestNumber?: number;
  pullRequestUrl?: string;
  branchUrl?: string;
  filesChanged: GitHubFileChangeResult[];
  status: "success" | "partial" | "error";
  error?: string;
  createdAt: string;
};

export type GitHubIssueDraft = {
  title: string;
  body: string;
  labels?: string[];
  relatedNodeId?: string;
  relatedTeamId?: string;
  priority?: "low" | "medium" | "high";
};

/** Basic repo-structure detection used by the file-placement assistant. */
export type RepoStructure = {
  isNext: boolean;
  isNode: boolean;
  isMonorepo: boolean;
  hasSrc: boolean;
  hasApp: boolean;
  hasPages: boolean;
  topLevelDirs: string[];
  /** ranked destination-path suggestions */
  suggestions: string[];
};
