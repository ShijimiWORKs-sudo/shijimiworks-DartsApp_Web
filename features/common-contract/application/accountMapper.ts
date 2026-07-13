import type { Account, AccountOverview } from '../../account/domain';
import type {
  CommonAccountJson,
  CommonAccountStatus,
  CommonAuthMode,
  CommonPlayerProfileJson,
} from '../domain/types';
import { isUuidV4 } from './validators';

export type CommonPlayerProfileSource = {
  id: string;
  accountId: string | null;
  playerType: 'owner' | 'guest';
  displayName: string;
  throwingHand?: 'right' | 'left' | 'unknown' | null;
  mainMachine?: string | null;
  selfReportedRating?: number | null;
  avatarUri?: string | null;
  createdAt: string;
  updatedAt: string;
};

export function toCommonAccountJson(account: Account): CommonAccountJson {
  return {
    schema_version: 1,
    account_id: account.id,
    legacy_account_id: isUuidV4(account.id) ? null : account.id,
    user_name: account.userName,
    display_name: account.displayName,
    email: account.emailNormalized,
    account_status: mapAccountStatus(account.status),
    auth_mode: mapAuthMode(account.authProvider),
    cloud_auth_subject: null,
    created_at: account.createdAt,
    updated_at: account.updatedAt,
    deleted_at: account.status === 'deleted' ? account.updatedAt : null,
  };
}

export function toCommonPlayerProfileJson(
  player: CommonPlayerProfileSource,
): CommonPlayerProfileJson {
  return {
    schema_version: 1,
    profile_id: player.id,
    account_id: player.accountId,
    player_type: player.playerType,
    display_name: player.displayName,
    throwing_hand: player.throwingHand ?? 'unknown',
    main_machine: player.mainMachine ?? null,
    rating_system_preference: 'dartsapp',
    self_reported_rating: player.selfReportedRating ?? null,
    avatar_uri: player.avatarUri ?? null,
    created_at: player.createdAt,
    updated_at: player.updatedAt,
  };
}

export function toCommonOwnerProfileJson(overview: AccountOverview): CommonPlayerProfileJson {
  return toCommonPlayerProfileJson({
    id: overview.ownerPlayer.id,
    accountId: overview.account.id,
    playerType: 'owner',
    displayName: overview.ownerPlayer.displayName,
    createdAt: overview.account.createdAt,
    updatedAt: overview.account.updatedAt,
  });
}

function mapAccountStatus(status: Account['status']): CommonAccountStatus {
  switch (status) {
    case 'profile_incomplete':
    case 'local_registered':
      return 'local_active';
    case 'cloud_verified':
      return 'cloud_active';
    case 'disabled':
      return 'suspended';
    case 'deleted':
      return 'deleted';
  }
}

function mapAuthMode(authProvider: Account['authProvider']): CommonAuthMode {
  switch (authProvider) {
    case 'local':
      return 'local_no_auth';
    case 'email':
      return 'email_password';
    case 'apple':
      return 'apple';
    case 'google':
      return 'google';
  }
}
