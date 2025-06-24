"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Users, MousePointerClick, PencilLine, Vote, Trophy, CheckSquare, Home, PlusCircle, LogIn } from "lucide-react";

const steps = [
  {
    icon: Home,
    title: "1. Enter the Olympic Village",
    description: "At the LOLympics homepage, you can either host your own meme games or join another country's delegation with a special access code.",
    details: [
      "Click 'Create Room' (<PlusCircle class='inline h-4 w-4'/>) to become the host nation.",
      "Enter a room code and click 'Join Room' (<LogIn class='inline h-4 w-4'/>) to join the international delegation."
    ]
  },
  {
    icon: Users,
    title: "2. The Opening Ceremony",
    description: "Once you've entered the Olympic Village, wait for other athletes to join. Everyone needs to light their torch (mark 'Ready') before the games can begin!",
    details: [
      "Share your Country Code (displayed at the top) with fellow athletes.",
      "Light your torch by toggling 'READY!' (<CheckSquare class='inline h-4 w-4'/>).",
      "The LOLympics will automatically begin when all athletes are ready to compete."
    ]
  },
  {
    icon: MousePointerClick,
    title: "3. Choose Your Battleground",
    description: "Each round begins with selecting the meme arena. Athletes vote on available meme templates, or a random one is selected by the Olympic Committee.",
    details: [
      "Browse the available meme arenas.",
      "Click on a meme to cast your vote for the battleground.",
      "A timer keeps things Olympic-fast, so choose quickly or be disqualified!"
    ]
  },
  {
    icon: PencilLine,
    title: "4. The Main Event: Caption Creation!",
    description: "Once the meme arena is chosen, it's time to flex those comedy muscles! Write your most gold-medal-worthy caption within the time limit or face humiliating defeat!",
    details: [
      "Type your hilarious caption in the text box.",
      "Watch the character limit and timer like a hawk!",
      "Submit your comedy masterpiece before the buzzer sounds or be forever shamed!"
    ]
  },
  {
    icon: Vote,
    title: "5. Judge the Competition",
    description: "All captions are displayed anonymously like athletes in disguise. Read through them and vote for the one you think deserves the gold (no voting for yourself, you narcissist!).",
    details: [
      "Captions are numbered for your judging convenience.",
      "Click the 'Vote' button on the caption that made you snort-laugh.",
      "The timer ensures no athlete gets special treatment."
    ]
  },
  {
    icon: Trophy,
    title: "6. Medal Ceremony & World Rankings",
    description: "After voting, the gold medal caption is revealed along with its creator! Points are awarded, national anthems play, and the world rankings are updated. The games continue to the next event or the closing ceremony!",
    details: [
      "See which athlete won gold and how many points they scored.",
      "Check your position in the world rankings.",
      "Prepare for the next event or the grand closing ceremony!"
    ]
  }
];

export function TutorialContent() {
  return (
    <div className="space-y-4 font-body">
      <p className="text-base text-foreground/90">
        Welcome to the LOLympics! Where meme-making is an Olympic sport and only the funniest win gold! No drug testing required, just pure comedy talent!
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
        May the funniest meme-lete win! Let the LOLympics begin! 🥇🥈🥉
      </p>
    </div>
  );
}
