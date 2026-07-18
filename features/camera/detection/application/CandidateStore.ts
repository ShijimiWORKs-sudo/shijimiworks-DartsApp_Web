import type {
  CameraDetectionCandidate,
  CandidateDestination,
  CandidateHistoryEntry,
  CandidateRouteStatus,
} from '../domain/types';

export class CandidateStore {
  private readonly entries: CandidateHistoryEntry[] = [];

  add(input: {
    candidate: CameraDetectionCandidate;
    destination: CandidateDestination;
    routeStatus: CandidateRouteStatus;
    now?: Date;
  }): CandidateHistoryEntry {
    const now = input.now ?? new Date();
    const entry: CandidateHistoryEntry = {
      candidate: input.candidate,
      destination: input.destination,
      routeStatus: input.routeStatus,
      createdAt: now.toISOString(),
      sentAt: input.routeStatus === 'sent' ? now.toISOString() : null,
      acceptedAt: null,
      rejectedAt: null,
    };

    this.entries.unshift(entry);
    return entry;
  }

  markAccepted(candidateId: string, now = new Date()) {
    this.update(candidateId, {
      acceptedAt: now.toISOString(),
      rejectedAt: null,
    });
  }

  markRejected(candidateId: string, now = new Date()) {
    this.update(candidateId, {
      acceptedAt: null,
      rejectedAt: now.toISOString(),
    });
  }

  list(): CandidateHistoryEntry[] {
    return [...this.entries];
  }

  clear() {
    this.entries.length = 0;
  }

  private update(candidateId: string, patch: Partial<CandidateHistoryEntry>) {
    const index = this.entries.findIndex((entry) => entry.candidate.candidateId === candidateId);
    if (index < 0) {
      return;
    }
    this.entries[index] = {
      ...this.entries[index],
      ...patch,
    };
  }
}
