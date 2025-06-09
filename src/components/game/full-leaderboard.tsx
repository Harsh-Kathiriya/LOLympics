"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PlayerAvatar } from "./player-avatar";
import { Trophy, Medal, Award as RibbonAward } from "lucide-react"; // Using Award as RibbonAward
import { ScrollArea } from "@/components/ui/scroll-area";

interface PlayerScore {
  id: string;
  name: string;
  avatarUrl?: string;
  score: number;
}

interface FullLeaderboardProps {
  players: PlayerScore[];
}

export function FullLeaderboard({ players }: FullLeaderboardProps) {
  const sortedPlayers = [...players]
    .sort((a, b) => b.score - a.score)
    .map((player, index) => ({ ...player, rank: index + 1 }));

  const getRankIndicator = (rank: number) => {
    if (rank === 1) return <Trophy className="h-6 w-6 text-yellow-400" />;
    if (rank === 2) return <Medal className="h-6 w-6 text-gray-400" />;
    if (rank === 3) return <RibbonAward className="h-6 w-6 text-orange-400" />; // Renamed Award to RibbonAward
    return <span className="font-bold text-lg text-muted-foreground w-6 text-center">{rank}</span>;
  };

  return (
    <Card className="shadow-xl w-full">
      <CardHeader className="text-center">
        <CardTitle className="font-headline text-3xl text-primary">Final Leaderboard</CardTitle>
        <CardDescription>Congratulations to all players!</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {sortedPlayers.map((player) => (
              <Card 
                key={player.id} 
                className={`p-3 flex items-center justify-between transition-all duration-300 hover:shadow-md ${
                  player.rank === 1 ? 'bg-yellow-400/20 border-yellow-500' : 
                  player.rank === 2 ? 'bg-gray-400/20 border-gray-500' :
                  player.rank === 3 ? 'bg-orange-400/20 border-orange-500' :
                  'bg-card/50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  {getRankIndicator(player.rank)}
                  <PlayerAvatar name={player.name} avatarUrl={player.avatarUrl} size="md" />
                </div>
                <span className={`font-bold text-xl ${
                   player.rank === 1 ? 'text-yellow-500' : 
                   player.rank === 2 ? 'text-gray-500' :
                   player.rank === 3 ? 'text-orange-500' :
                   'text-primary'
                }`}>
                  {player.score} pts
                </span>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
