import { EmailService, Game, GameRepo, LeagueRepo, LockManager, UUID, noLock } from "./contracts";

export class MatchmakingService {
	constructor(
		private readonly games: GameRepo,
		private readonly leagues: LeagueRepo,
		private readonly email: EmailService,
		private readonly lock: LockManager = noLock
	) {}

	// Ensures the player has an active game; if not, tries to create one with a suitable opponent.
	async ensureMatchForPlayer(leagueId: UUID, playerId: UUID): Promise<Game | null> {
		// Check if player already has an active game.
		const active = await this.games.getActiveGameForPlayer(leagueId, playerId);
		if (active) return active;

		// Gather candidates: league members except self.
		const members = await this.leagues.listMembers(leagueId);
		const candidates = members.filter(m => m.id !== playerId);

		// Filter candidates who are currently free (no active game).
		const freeCandidates: { id: UUID; email?: string | null }[] = [];
		for (const candidate of candidates) {
			const candidateActive = await this.games.getActiveGameForPlayer(leagueId, candidate.id);
			if (!candidateActive) freeCandidates.push(candidate);
		}
		if (freeCandidates.length === 0) return null;

		// Prefer opponents the player hasn't played before.
		const unseen: UUID[] = [];
		const seen: UUID[] = [];
		for (const c of freeCandidates) {
			const playedBefore = await this.games.havePlayersPlayedBefore(leagueId, playerId, c.id);
			if (playedBefore) seen.push(c.id);
			else unseen.push(c.id);
		}
		const preferenceOrder = unseen.concat(seen);

		// Try to create a game with candidates by preference.
		for (const opponentId of preferenceOrder) {
			// Defensive: never try to pair a player with themselves.
			if (opponentId === playerId) continue;

			const pairKey = this.pairLockKey(leagueId, playerId, opponentId);
			const created = await this.lock.withLock(pairKey, async () => {
				// Double-check both are still free, then create atomically.
				return this.games.createIfBothPlayersFree(leagueId, playerId, opponentId);
			});
			if (created) {
				// Defensive: if repo accidentally created a self-match, clean it up and continue.
				if (created.playerAId === created.playerBId) {
					if (typeof this.games.deleteById === "function") {
						await this.games.deleteById(created.id);
					} else {
						await this.games.markCompleted(created.id);
					}
					continue; // try next opponent
				}

				await this.sendInvitations(created, members, playerId, opponentId);
				return created;
			}
		}
		return null;
	}

	// Call this after a game’s date or result is saved.
	async handleGameUpdated(gameId: UUID): Promise<void> {
		const game = await this.games.getById(gameId);
		if (!game) return;

		const hasDate = !!game.scheduledAt;
		const hasResult = !!game.result && String(game.result).trim().length > 0;

		if (hasDate && hasResult && !game.completed) {
			await this.games.markCompleted(game.id);
		}

		if (hasDate && hasResult) {
			// Attempt rematch for both players in the same league.
			await Promise.all([
				this.ensureMatchForPlayer(game.leagueId, game.playerAId),
				this.ensureMatchForPlayer(game.leagueId, game.playerBId),
			]);
		}
	}

	// Useful to run periodically to ensure all members have a match.
	async backfillLeague(leagueId: UUID): Promise<void> {
		const members = await this.leagues.listMembers(leagueId);
		for (const m of members) {
			await this.ensureMatchForPlayer(leagueId, m.id);
		}
	}

	private async sendInvitations(game: Game, members: { id: UUID; email?: string | null }[], a: UUID, b: UUID) {
		const to = members
			.filter(m => m.id === a || m.id === b)
			.map(m => ({ email: m.email ?? "", playerId: m.id }))
			.filter(x => x.email);
		if (to.length > 0) {
			await this.email.sendMatchInvitation(to, game);
		}
	}

	private pairLockKey(leagueId: UUID, a: UUID, b: UUID): string {
		const [x, y] = [a, b].sort();
		return `match:${leagueId}:${x}-${y}`;
	}
}
