export type UUID = string;

export interface Player {
	id: UUID;
	email?: string | null;
}

export interface Game {
	id: UUID;
	leagueId: UUID;
	playerAId: UUID;
	playerBId: UUID;
	scheduledAt?: Date | null;
	result?: string | null;
	completed: boolean;
	// ...existing code...
}

export interface GameRepo {
	// Returns the active (not completed) game for a player in a league, if any.
	getActiveGameForPlayer(leagueId: UUID, playerId: UUID): Promise<Game | null>;

	// True if these players have ever played each other in this league (completed or not).
	havePlayersPlayedBefore(leagueId: UUID, playerAId: UUID, playerBId: UUID): Promise<boolean>;

	// Atomically creates a game only if both players currently have no active game in this league.
	// Returns the created game or null if not created.
	createIfBothPlayersFree(leagueId: UUID, playerAId: UUID, playerBId: UUID): Promise<Game | null>;

	// Get game by id
	getById(gameId: UUID): Promise<Game | null>;

	// Mark a game as completed = true
	markCompleted(gameId: UUID): Promise<void>;

	// Optional: delete a game by id (used for cleanup if a bad row is created accidentally).
	deleteById?(gameId: UUID): Promise<void>;
}

export interface LeagueRepo {
	// All members of a league (include email if available for invitations).
	listMembers(leagueId: UUID): Promise<Player[]>;
}

export interface EmailService {
	// Send a match invitation to both players.
	sendMatchInvitation(to: { email: string; playerId: UUID }[], game: Game): Promise<void>;
}

export interface LockManager {
	// Provide a short-lived mutex to prevent duplicate pair creation across concurrent calls.
	withLock<T>(key: string, fn: () => Promise<T>): Promise<T>;
}

// Fallback no-op lock (single-instance only). Provide a distributed lock (e.g., Redis) in production.
export const noLock: LockManager = {
	withLock: async (_key, fn) => fn(),
};
