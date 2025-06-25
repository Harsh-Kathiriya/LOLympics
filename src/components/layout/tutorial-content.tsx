"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Users, MousePointerClick, PencilLine, Vote, Trophy, CheckSquare, Home, PlusCircle, LogIn } from "lucide-react";

const steps = [
  {
    icon: Home,
    title: "1. Enter the Olympic Village",
    description: "At the LOLympics homepage, you can either host your own meme games or join another country's delegation with a special access code.",
    details: [
      { text: "Click 'Create Room' ", icon: PlusCircle, suffix: " to become the host nation." },
      { text: "Enter a room code and click 'Join Room' ", icon: LogIn, suffix: " to join the international delegation." }
    ]
  },
  {
    icon: Users,
    title: "2. The Opening Ceremony",
    description: "Once you've entered the Olympic Village, wait for other athletes to join. Everyone needs to light their torch (mark 'Ready') before the games can begin!",
    details: [
      { text: "Share your Country Code (displayed at the top) with fellow athletes.", icon: null, suffix: "" },
      { text: "Light your torch by toggling 'READY!' ", icon: CheckSquare, suffix: "." },
      { text: "The LOLympics will automatically begin when all athletes are ready to compete.", icon: null, suffix: "" }
    ]
  },
  {
    icon: MousePointerClick,
    title: "3. Choose Your Battleground",
    description: "Each round begins with selecting the meme arena. Athletes vote on available meme templates, or a random one is selected by the Olympic Committee.",
    details: [
      { text: "Browse the available meme arenas.", icon: null, suffix: "" },
      { text: "Click on a meme to cast your vote for the battleground.", icon: null, suffix: "" },
      { text: "A timer keeps things Olympic-fast, so choose quickly or be disqualified!", icon: null, suffix: "" }
    ]
  },
  {
    icon: PencilLine,
    title: "4. The Main Event: Caption Creation!",
    description: "Once the meme arena is chosen, it's time to flex those comedy muscles! Write your most gold-medal-worthy caption within the time limit or face humiliating defeat!",
    details: [
      { text: "Type your hilarious caption in the text box.", icon: null, suffix: "" },
      { text: "Watch the character limit and timer like a hawk!", icon: null, suffix: "" },
      { text: "Submit your comedy masterpiece before the buzzer sounds or be forever shamed!", icon: null, suffix: "" }
    ]
  },
  {
    icon: Vote,
    title: "5. Judge the Competition",
    description: "All captions are displayed anonymously like athletes in disguise. Read through them and vote for the one you think deserves the gold (no voting for yourself, you narcissist!).",
    details: [
      { text: "Captions are numbered for your judging convenience.", icon: null, suffix: "" },
      { text: "Click the 'Vote' button on the caption that made you snort-laugh.", icon: null, suffix: "" },
      { text: "The timer ensures no athlete gets special treatment.", icon: null, suffix: "" }
    ]
  },
  {
    icon: Trophy,
    title: "6. Medal Ceremony & World Rankings",
    description: "After voting, the gold medal caption is revealed along with its creator! Points are awarded, national anthems play, and the world rankings are updated. The games continue to the next event or the closing ceremony!",
    details: [
      { text: "See which athlete won gold and how many points they scored.", icon: null, suffix: "" },
      { text: "Check your position in the world rankings.", icon: null, suffix: "" },
      { text: "Prepare for the next event or the grand closing ceremony!", icon: null, suffix: "" }
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
                  <li key={i} className="flex items-center">
                    <span>
                      {detail.text}
                      {detail.icon && <detail.icon className="inline h-4 w-4 mx-1 relative top-px" />}
                      {detail.suffix}
                    </span>
                  </li>
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
