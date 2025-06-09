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
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score).map((p, idx) => ({...p, rank: idx + 1}));
  const topPlayers = sortedPlayers.slice(0, topN);
  const currentPlayer = currentPlayerId ? sortedPlayers.find(p => p.id === currentPlayerId) : null;

  return (
    <Card className="bg-card/70 shadow-md">
      <CardHeader>
        <CardTitle className="font-headline text-xl flex items-center text-accent">
          <BarChart2 className="mr-2 h-6 w-6" />
          Leaderboard Snippet
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {topPlayers.map((player, index) => (
          <div key={player.id} className="flex items-center justify-between p-2 rounded-md bg-background/50">
            <div className="flex items-center">
              <span className={`font-bold text-lg mr-3 w-6 text-center ${index === 0 ? 'text-yellow-400' : (index === 1 ? 'text-gray-400' : (index === 2 ? 'text-orange-400' : 'text-muted-foreground'))}`}>
                {player.rank}
                {index === 0 && <Trophy className="inline ml-1 h-4 w-4 text-yellow-400" />}
              </span>
              <PlayerAvatar name={player.name} avatarUrl={player.avatarUrl} size="sm" />
            </div>
            <span className="font-bold text-lg text-primary">{player.score} pts</span>
          </div>
        ))}
        {currentPlayer && !topPlayers.find(p => p.id === currentPlayerId) && (
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
