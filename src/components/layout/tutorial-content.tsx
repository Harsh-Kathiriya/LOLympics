"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Users, MousePointerClick, PencilLine, Vote, Trophy, CheckSquare, Home, PlusCircle, LogIn } from "lucide-react";

const steps = [
  {
    icon: Home,
    title: "1. Start or Join a Game",
    description: "On the homepage, you can either create a new game room or join an existing one using a room code. If creating, a unique code will be generated for you to share.",
    details: [
      "Click 'Create Room' (<PlusCircle class='inline h-4 w-4'/>) to start a new game.",
      "Enter a room code and click 'Join Room' (<LogIn class='inline h-4 w-4'/>) to join friends."
    ]
  },
  {
    icon: Users,
    title: "2. The Lobby",
    description: "Once in a room, you'll land in the lobby. Wait for other players to join. Everyone needs to mark themselves as 'Ready' before the game can start.",
    details: [
      "Share the Room Code (displayed at the top) with friends.",
      "Toggle your status to 'READY!' (<CheckSquare class='inline h-4 w-4'/>).",
      "The game will automatically start when everyone is ready."
    ]
  },
  {
    icon: MousePointerClick,
    title: "3. Meme Selection / Voting",
    description: "Each round begins with choosing a meme. Players vote on available memes, or a random meme is selected from the pool.",
    details: [
      "Browse the available memes.",
      "Click on a meme to select or vote for it.",
      "A timer keeps things snappy, so choose quickly!"
    ]
  },
  {
    icon: PencilLine,
    title: "4. Caption This!",
    description: "Once a meme is chosen for the round, it's time to get creative! Write your funniest, wittiest, or most outrageous caption for the displayed meme within the time limit.",
    details: [
      "Type your caption in the text box.",
      "Keep an eye on the character limit and the timer.",
      "Submit your masterpiece before time runs out!"
    ]
  },
  {
    icon: Vote,
    title: "5. Vote for the Best Caption",
    description: "All submitted captions for the round are displayed anonymously. Read through them and vote for the one you think is the best (you can't vote for your own!).",
    details: [
      "Captions are numbered for easy voting.",
      "Click the 'Vote' button on your favorite caption.",
      "Again, a timer ensures the game keeps moving."
    ]
  },
  {
    icon: Trophy,
    title: "6. Round Results & Leaderboard",
    description: "After voting, the winning caption for the round is revealed, along with its author. Points are awarded, and the overall leaderboard is updated. The game proceeds to the next round or, if it's the final round, to the final results screen.",
    details: [
      "See who won the round and how many points they got.",
      "Check your position on the leaderboard.",
      "Prepare for the next round or the grand finale!"
    ]
  }
];

export function TutorialContent() {
  return (
    <div className="space-y-4 font-body">
      <p className="text-base text-foreground/90">
        Welcome to Caption Clash! The game is simple: make 'em laugh with your meme captions and vote for the funniest.
      </p>
      <Accordion type="single" collapsible className="w-full">
        {steps.map((step, index) => (
          <AccordionItem value={`item-${index}`} key={index} className="border-primary/20">
            <AccordionTrigger className="text-lg hover:no-underline hover:text-primary font-headline text-left">
              <div className="flex items-center">
                <step.icon className="mr-3 h-6 w-6 text-primary shrink-0" />
                {step.title}
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-2 text-sm text-foreground/80 pl-2">
              <p>{step.description}</p>
              <ul className="list-disc list-inside space-y-1 pl-4">
                {step.details.map((detail, i) => (
                  <li key={i} dangerouslySetInnerHTML={{ __html: detail.replace(/<([a-zA-Z0-9_]+) class='inline h-4 w-4'\/>/g, (match, p1) => {
                    // This is a hacky way to render icons; in a real app, use React components.
                    if (p1 === 'PlusCircle') return '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-plus-circle inline h-4 w-4 relative top-px"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="16"/><line x1="8" x2="16" y1="12" y2="12"/></svg>';
                    if (p1 === 'LogIn') return '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-log-in inline h-4 w-4 relative top-px"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" x2="3" y1="12" y2="12"/></svg>';
                    if (p1 === 'CheckSquare') return '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check-square inline h-4 w-4 relative top-px"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>';
                    return '';
                  }) }} />
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      <p className="text-center text-sm text-accent font-semibold pt-4">
        Good luck, and may the best captioner win!
      </p>
    </div>
  );
}
