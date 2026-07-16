import type {
  CameraDetectionCandidate,
  CandidateDestination,
  CandidateRouteResult,
  CandidateRouterContext,
  CandidateRouterPort,
} from '../domain/types';
import { CandidateStore } from './CandidateStore';

export class CandidateRouter {
  constructor(
    private readonly store: CandidateStore,
    private readonly port: CandidateRouterPort,
  ) {}

  route(
    candidate: CameraDetectionCandidate,
    context: CandidateRouterContext,
  ): CandidateRouteResult {
    const destination = resolveCandidateDestination(context);

    if (context.isAuthorityChanging && destination !== 'preview') {
      this.store.add({
        candidate,
        destination,
        routeStatus: 'blocked',
      });
      return {
        destination,
        status: 'blocked',
        reason: 'AUTHORITY_CHANGING',
        candidateId: candidate.candidateId,
      };
    }

    if (destination === 'preview') {
      this.port.showPreview(candidate);
      this.store.add({ candidate, destination, routeStatus: 'stored' });
      return {
        destination,
        status: 'stored',
        reason: null,
        candidateId: candidate.candidateId,
      };
    }

    if (destination === 'local_game') {
      if (context.authority !== 'camera_pc') {
        this.store.add({ candidate, destination, routeStatus: 'blocked' });
        return {
          destination,
          status: 'blocked',
          reason: 'CAMERA_PC_NOT_AUTHORITY',
          candidateId: candidate.candidateId,
        };
      }

      this.port.handoffToLocalGame(candidate);
      this.store.add({ candidate, destination, routeStatus: 'stored' });
      return {
        destination,
        status: 'stored',
        reason: null,
        candidateId: candidate.candidateId,
      };
    }

    if (!context.isLanConnected) {
      this.store.add({ candidate, destination, routeStatus: 'not_sent' });
      return {
        destination,
        status: 'not_sent',
        reason: 'LAN_NOT_CONNECTED',
        candidateId: candidate.candidateId,
      };
    }

    this.port.sendToLanHost(candidate);
    this.store.add({ candidate, destination, routeStatus: 'sent' });
    return {
      destination,
      status: 'sent',
      reason: null,
      candidateId: candidate.candidateId,
    };
  }
}

export function resolveCandidateDestination(context: CandidateRouterContext): CandidateDestination {
  if (context.operationMode === 'local_game' || context.operationMode === 'local_count_up') {
    return 'local_game';
  }
  if (context.operationMode === 'paired_node') {
    return 'lan_host';
  }
  return 'preview';
}
