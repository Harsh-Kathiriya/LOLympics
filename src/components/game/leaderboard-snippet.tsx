"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlayerAvatar } from "./player-avatar";
import { Trophy, BarChart2 } from "lucide-react";

interface PlayerScore {
  id: string;
  name: string;
  avatarUrl?: string;
  score: number;
  rank?: number;
}

interface LeaderboardSnippetProps {
  players: PlayerScore[];
  currentPlayerId?: string;
  topN?: number;
}

export function LeaderboardSnippet({ players, currentPlayerId, topN = 3 }: LeaderboardSnippetProps) {
  // New, correct ranking logic that handles ties
  const getRankedPlayers = (players: PlayerScore[]): PlayerScore[] => {
    const sorted = [...players].sort((a, b) => b.score - a.score);
    if (sorted.length === 0) return [];

    let rank = 1;
    return sorted.map((player, index) => {
      // If the current player's score is less than the previous one, they get the new rank (index + 1)
      if (index > 0 && player.score < sorted[index - 1].score) {
        rank = index + 1;
      }
      return { ...player, rank };
    });
  };

  const rankedPlayers = getRankedPlayers(players);
  const topPlayers = rankedPlayers.slice(0, topN);
  const currentPlayer = currentPlayerId ? rankedPlayers.find(p => p.id === currentPlayerId) : null;

  return (
    <Card className="bg-card/70 shadow-md">
      <CardHeader>
        <CardTitle className="font-headline text-xl flex items-center text-accent">
          <BarChart2 className="mr-2 h-6 w-6" />
          Leaderboard
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {topPlayers.map((player) => (
          <div key={player.id} className="flex items-center justify-between p-2 rounded-md bg-background/50">
            <div className="flex items-center">
              <span className={`font-bold text-lg mr-3 w-6 text-center ${player.rank === 1 ? 'text-yellow-400' : 'text-muted-foreground'}`}>
                {player.rank}
                {player.rank === 1 && <Trophy className="inline ml-1 h-4 w-4 text-yellow-400" />}
              </span>
              <PlayerAvatar name={player.name} avatarUrl={player.avatarUrl} size="sm" />
            </div>
            <span className="font-bold text-lg text-primary">{player.score} pts</span>
          </div>
        ))}
        {currentPlayer && !topPlayers.some(p => p.id === currentPlayerId) && (
          <>
            <div className="text-center text-muted-foreground my-2">...</div>
            <div className="flex items-center justify-between p-2 rounded-md bg-primary/20 border border-primary">
              <div className="flex items-center">
                <span className="font-bold text-lg mr-3 w-6 text-center text-primary">
                  {currentPlayer.rank}
                </span>
                <PlayerAvatar name={currentPlayer.name} avatarUrl={currentPlayer.avatarUrl} size="sm" />
              </div>
              <span className="font-bold text-lg text-primary">{currentPlayer.score} pts</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}