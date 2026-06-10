/**
 * Cognito Admin (user-lifecycle) service — replaces the Kinde Management API user operations.
 *
 * Part of the Kinde -> Cognito migration (P4). The Wrapper OWNS tenancy/orgs/roles in its own DB,
 * so the old Kinde org methods (createOrganization / addUserToOrganization / removeUserFromOrganization
 * / getUserOrganizations) are DROPPED — membership lives in organization_memberships / userRoleAssignments.
 * Only USER lifecycle moves to Cognito: create (invites/admin), disable, delete, lookup.
 *
 * Auth: the AWS SDK default credential chain (env / ~/.aws / instance role). In dev it uses the
 * ambient Deployment-Manager creds (same as the SNS/SQS clients); in prod, an instance role / env
 * creds with `cognito-idp:Admin*` on the pool.
 */
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminDeleteUserCommand,
  AdminGetUserCommand,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
  AdminListGroupsForUserCommand,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import Logger from '../../../utils/logger.js';

const REGION = process.env.COGNITO_REGION || process.env.AWS_REGION || 'us-east-1';

let cachedClient: CognitoIdentityProviderClient | null = null;
function client(): CognitoIdentityProviderClient {
  if (!cachedClient) cachedClient = new CognitoIdentityProviderClient({ region: REGION });
  return cachedClient;
}
function poolId(): string {
  const id = (process.env.COGNITO_USER_POOL_ID || '').trim();
  if (!id) throw new Error('COGNITO_USER_POOL_ID is not set');
  return id;
}
function subOf(attrs?: { Name?: string; Value?: string }[]): string {
  return attrs?.find((a) => a.Name === 'sub')?.Value ?? '';
}

export interface CognitoUserRef {
  sub: string;
  username: string;
}

/**
 * Create a Cognito user (replaces kindeService.createUser). Used so invited / admin-created users
 * can sign in. email_verified=true; MessageAction=SUPPRESS — the Wrapper sends its own invite, and
 * the user signs in via Google (email-matched) or sets a password via Cognito forgot-password.
 * Idempotent: if the user already exists, returns the existing sub.
 */
export async function adminCreateUser(input: { email: string; firstName?: string; lastName?: string }): Promise<CognitoUserRef> {
  const UserPoolId = poolId();
  const UserAttributes: { Name: string; Value: string }[] = [
    { Name: 'email', Value: input.email },
    { Name: 'email_verified', Value: 'true' },
  ];
  if (input.firstName) UserAttributes.push({ Name: 'given_name', Value: input.firstName });
  if (input.lastName) UserAttributes.push({ Name: 'family_name', Value: input.lastName });
  try {
    const res = await client().send(new AdminCreateUserCommand({
      UserPoolId, Username: input.email, UserAttributes, MessageAction: 'SUPPRESS',
    }));
    return { sub: subOf(res.User?.Attributes), username: res.User?.Username ?? input.email };
  } catch (err) {
    if ((err as { name?: string })?.name === 'UsernameExistsException') {
      const existing = await adminGetUserByEmail(input.email);
      if (existing) return existing;
    }
    Logger.log('error', 'cognito', 'admin-create-user', 'AdminCreateUser failed', { email: input.email, error: (err as Error).message });
    throw err;
  }
}

/** Look up a Cognito user by email (AdminGetUser by username=email, then ListUsers filter). */
export async function adminGetUserByEmail(email: string): Promise<CognitoUserRef | null> {
  const UserPoolId = poolId();
  try {
    const res = await client().send(new AdminGetUserCommand({ UserPoolId, Username: email }));
    return { sub: subOf(res.UserAttributes), username: res.Username ?? email };
  } catch (err) {
    if ((err as { name?: string })?.name !== 'UserNotFoundException') {
      if (process.env.NODE_ENV !== 'production') Logger.log('warning', 'cognito', 'admin-get-user', 'AdminGetUser failed, trying ListUsers', { error: (err as Error).message });
    }
    try {
      const list = await client().send(new ListUsersCommand({ UserPoolId, Filter: `email = "${email}"`, Limit: 1 }));
      const u = list.Users?.[0];
      if (!u) return null;
      return { sub: subOf(u.Attributes), username: u.Username ?? email };
    } catch {
      return null;
    }
  }
}

export async function adminDisableUser(email: string): Promise<void> {
  try { await client().send(new AdminDisableUserCommand({ UserPoolId: poolId(), Username: email })); }
  catch (err) { if ((err as { name?: string })?.name !== 'UserNotFoundException') throw err; }
}

export async function adminEnableUser(email: string): Promise<void> {
  try { await client().send(new AdminEnableUserCommand({ UserPoolId: poolId(), Username: email })); }
  catch (err) { if ((err as { name?: string })?.name !== 'UserNotFoundException') throw err; }
}

export async function adminDeleteUser(email: string): Promise<void> {
  try { await client().send(new AdminDeleteUserCommand({ UserPoolId: poolId(), Username: email })); }
  catch (err) { if ((err as { name?: string })?.name !== 'UserNotFoundException') throw err; }
}

// ─── Platform-admin group management ─────────────────────────────────────────
// The platform-admin plane is signalled by membership of a dedicated Cognito group
// (COGNITO_PLATFORM_ADMIN_GROUP, default `platform-admins`), surfaced in tokens via
// the native `cognito:groups` claim. These helpers let a platform admin promote /
// demote other staff into that group. The group itself is provisioned in Terraform.

function platformAdminGroup(): string {
  return (process.env.COGNITO_PLATFORM_ADMIN_GROUP || 'platform-admins').trim();
}

/** Add a user (by email username) to a Cognito group; defaults to the platform-admin group. */
export async function adminAddUserToGroup(email: string, groupName: string = platformAdminGroup()): Promise<void> {
  await client().send(new AdminAddUserToGroupCommand({ UserPoolId: poolId(), Username: email, GroupName: groupName }));
}

/** Remove a user from a Cognito group; defaults to the platform-admin group. */
export async function adminRemoveUserFromGroup(email: string, groupName: string = platformAdminGroup()): Promise<void> {
  try { await client().send(new AdminRemoveUserFromGroupCommand({ UserPoolId: poolId(), Username: email, GroupName: groupName })); }
  catch (err) { if ((err as { name?: string })?.name !== 'UserNotFoundException') throw err; }
}

/** List the Cognito group names a user belongs to (by email username). */
export async function adminListGroupsForUser(email: string): Promise<string[]> {
  const res = await client().send(new AdminListGroupsForUserCommand({ UserPoolId: poolId(), Username: email }));
  return (res.Groups ?? []).map((g) => g.GroupName ?? '').filter(Boolean);
}
